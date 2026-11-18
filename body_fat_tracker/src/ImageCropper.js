import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { imageLayout, outputSize, pixelCrop, restoreCrop } from './cropGeometry';
import { removeTemporaryPhoto } from './photoFiles';
import { Button, colors, Notice, ui } from './ui';

const identity = { zoom: 1, x: 0, y: 0 };
const midpoint = touches => ({ x: (touches[0].locationX + touches[1].locationX) / 2,
  y: (touches[0].locationY + touches[1].locationY) / 2 });
const distance = touches => Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);

export default function ImageCropper({ source, initialCrop, initialRatio = .75, onSave, onCancel }) {
  const [working, setWorking] = useState(source);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const [ratio, setRatio] = useState(initialRatio);
  const [transform, setTransform] = useState(identity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const locked = useRef(false);
  const generated = useRef(new Set());
  const retained = useRef(null);
  const initial = useRef(initialCrop);
  const current = useRef({ working, canvas, ratio, transform });
  const gesture = useRef(null);
  current.current = { working, canvas, ratio, transform };
  const layout = canvas.width > 0 && canvas.height > 0 ? imageLayout(working, canvas, ratio, transform) : null;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const uri of generated.current) if (uri !== retained.current) removeTemporaryPhoto(uri);
    };
  }, []);

  function updateTransform(next) {
    const value = current.current;
    if (!value.canvas.width || !value.canvas.height) return;
    const bounded = imageLayout(value.working, value.canvas, value.ratio, next);
    const transform = { zoom: bounded.zoom, x: bounded.x, y: bounded.y };
    current.current = { ...value, transform };
    setTransform(transform);
  }

  function startGesture(touches) {
    const value = current.current;
    gesture.current = {
      count: touches.length, transform: { ...value.transform },
      point: { x: touches[0].pageX, y: touches[0].pageY },
      midpoint: touches.length >= 2 ? midpoint(touches) : null,
      distance: touches.length >= 2 ? distance(touches) : 0,
    };
  }

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !locked.current,
    onMoveShouldSetPanResponder: () => !locked.current,
    onPanResponderGrant: event => startGesture(event.nativeEvent.touches),
    onPanResponderMove: event => {
      const touches = event.nativeEvent.touches;
      if (locked.current || !touches.length) return;
      if (!gesture.current || gesture.current.count !== touches.length) { startGesture(touches); return; }
      const start = gesture.current, value = current.current;
      if (touches.length >= 2 && start.distance > 0) {
        const zoom = Math.max(1, Math.min(6, start.transform.zoom * distance(touches) / start.distance));
        const factor = zoom / start.transform.zoom;
        const mid = midpoint(touches);
        updateTransform({ zoom,
          x: mid.x - value.canvas.width / 2 - (start.midpoint.x - value.canvas.width / 2 - start.transform.x) * factor,
          y: mid.y - value.canvas.height / 2 - (start.midpoint.y - value.canvas.height / 2 - start.transform.y) * factor });
      } else {
        updateTransform({ ...start.transform,
          x: start.transform.x + touches[0].pageX - start.point.x,
          y: start.transform.y + touches[0].pageY - start.point.y });
      }
    },
    onPanResponderRelease: () => { gesture.current = null; },
    onPanResponderTerminate: () => { gesture.current = null; },
    onPanResponderTerminationRequest: () => false,
  })).current;

  function changeRatio(next) {
    initial.current = null;
    current.current = { ...current.current, ratio: next, transform: identity };
    setRatio(next); setTransform(identity); setError('');
  }

  function zoomBy(delta) {
    const old = current.current.transform;
    const zoom = Math.max(1, Math.min(6, old.zoom + delta));
    const factor = zoom / old.zoom;
    updateTransform({ zoom, x: old.x * factor, y: old.y * factor });
  }

  async function turn(kind) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    const context = ImageManipulator.manipulate(current.current.working.uri);
    let rendered, result;
    try {
      if (kind === 'rotate') context.rotate(90); else context.flip('horizontal');
      rendered = await context.renderAsync();
      result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: .95 });
      generated.current.add(result.uri);
      if (!alive.current) { removeTemporaryPhoto(result); return; }
      current.current = { ...current.current, working: result, transform: identity };
      initial.current = null;
      setWorking(result); setTransform(identity);
    } catch { if (alive.current) setError('Could not adjust the photo. Please try again.'); }
    finally {
      rendered?.release?.(); context.release?.(); locked.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function save() {
    if (locked.current || !layout) return;
    locked.current = true; setBusy(true); setError('');
    let context, rendered, result;
    try {
      const value = current.current;
      const crop = pixelCrop(value.working, value.canvas, value.ratio, value.transform);
      const size = outputSize(crop);
      context = ImageManipulator.manipulate(value.working.uri);
      context.crop(crop);
      if (size.width !== crop.width || size.height !== crop.height) context.resize(size);
      rendered = await context.renderAsync();
      result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: .85, base64: true });
      if (!alive.current) { removeTemporaryPhoto(result); return; }
      if (!result.base64) throw new Error('Could not prepare the cropped photo for analysis.');
      retained.current = value.working.uri;
      onSave({ ...result, editSource: value.working, editCrop: crop, editRatio: value.ratio });
    } catch (failure) {
      removeTemporaryPhoto(result);
      if (alive.current) setError(failure.message || 'Could not save the crop.');
    } finally {
      rendered?.release?.(); context?.release?.(); locked.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const frame = layout?.frame;
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!locked.current) onCancel(); }}>
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={ui.heading}>Adjust torso photo</Text>
        <Text style={ui.small}>Drag to position · pinch to zoom. Keep shoulders and hips inside the crop.</Text>
      </View>
      <View style={styles.canvas} {...responder.panHandlers} onLayout={event => {
        const next = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
        const previous = current.current;
        const crop = initial.current || (previous.canvas.width > 0 && previous.canvas.height > 0
          ? pixelCrop(previous.working, previous.canvas, previous.ratio, previous.transform) : null);
        const restored = restoreCrop(previous.working, next, previous.ratio, crop);
        initial.current = null;
        current.current = { ...previous, canvas: next, transform: restored };
        setCanvas(next); setTransform(restored);
      }}>
        {layout && <>
          <Image pointerEvents="none" source={{ uri: working.uri }} resizeMode="stretch"
            style={{ position: 'absolute', left: layout.left, top: layout.top, width: layout.width, height: layout.height }} />
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.shade, { left: 0, top: 0, width: canvas.width, height: frame.top }]} />
            <View style={[styles.shade, { left: 0, top: frame.top + frame.height, width: canvas.width, bottom: 0 }]} />
            <View style={[styles.shade, { left: 0, top: frame.top, width: frame.left, height: frame.height }]} />
            <View style={[styles.shade, { left: frame.left + frame.width, top: frame.top, right: 0, height: frame.height }]} />
            <View style={[styles.cropFrame, { left: frame.left, top: frame.top, width: frame.width, height: frame.height }]}>
              {[1, 2].map(index => <View key={`v${index}`} style={[styles.grid, { left: `${index * 100 / 3}%`, top: 0, bottom: 0, width: 1 }]} />)}
              {[1, 2].map(index => <View key={`h${index}`} style={[styles.grid, { top: `${index * 100 / 3}%`, left: 0, right: 0, height: 1 }]} />)}
            </View>
          </View>
        </>}
        {busy && <View pointerEvents="none" style={styles.spinner}><ActivityIndicator color={colors.accent} size="large" /></View>}
      </View>
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlRow}>
          {[['Portrait', .75], ['Square', 1], ['Landscape', 4/3], ['Original', working.width / working.height]].map(([name, value]) =>
            <Button key={name} secondary={Math.abs(ratio - value) > .001} disabled={busy} onPress={() => changeRatio(value)}>{name}</Button>)}
        </ScrollView>
        <View style={styles.controlRow}>
          <Button secondary disabled={busy || transform.zoom <= 1} onPress={() => zoomBy(-.25)}>− Zoom</Button>
          <Text style={ui.small}>{transform.zoom.toFixed(1)}×</Text>
          <Button secondary disabled={busy || transform.zoom >= 6} onPress={() => zoomBy(.25)}>+ Zoom</Button>
        </View>
        <View style={styles.controlRow}>
          <Button secondary disabled={busy} onPress={() => turn('rotate')}>Rotate 90°</Button>
          <Button secondary disabled={busy} onPress={() => turn('flip')}>Flip</Button>
          <Button secondary disabled={busy} onPress={() => { updateTransform(identity); setError(''); }}>Recenter</Button>
        </View>
        {!!error && <Notice>{error}</Notice>}
        <View style={styles.controlRow}>
          <Button secondary disabled={busy} onPress={onCancel} style={{ flex: 1 }}>Cancel</Button>
          <Button disabled={busy || !layout} onPress={save} style={{ flex: 1 }}>{busy ? 'Preparing…' : 'Use this crop'}</Button>
        </View>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 8 },
  canvas: { flex: 1, minHeight: 180, backgroundColor: '#050805', overflow: 'hidden' },
  shade: { position: 'absolute', backgroundColor: '#000000aa' },
  cropFrame: { position: 'absolute', borderWidth: 2, borderColor: colors.accent },
  grid: { position: 'absolute', backgroundColor: '#ffffff44' },
  spinner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000066' },
  controls: { padding: 16, gap: 12 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
