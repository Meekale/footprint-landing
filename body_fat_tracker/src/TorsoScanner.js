import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import ImageCropper from './ImageCropper';
import { normalizePhoto, removeTemporaryPhoto } from './photoFiles';
import { requestAnalysis } from './api';
import { Button, colors, Field, Notice, ui } from './ui';

const sourceNames = {
  reddit_visual: 'Reddit visual estimates',
  auto_labeled: 'Automatically generated labels',
  reported_dexa: 'Dataset-reported DXA measurements',
};

export default function TorsoScanner() {
  const [permission, askPermission, getPermission] = useCameraPermissions();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [age, setAge] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [model, setModel] = useState(null);
  const [checking, setChecking] = useState(true);
  const [stage, setStage] = useState('setup');
  const [photo, setPhoto] = useState(null);
  const [editor, setEditor] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState('');
  const [libraryPermissionError, setLibraryPermissionError] = useState(false);
  const [facing, setFacing] = useState('back');
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const camera = useRef(null);
  const photoRef = useRef(null);
  const originalRef = useRef(null);
  const editorRef = useRef(null);
  const analysisRequest = useRef(null);
  const healthRequest = useRef(null);
  const mounted = useRef(true);
  const mediaLock = useRef(false);
  const analysisLock = useRef(false);
  const healthGeneration = useRef(0);
  const unavailable = busy || mediaBusy || checking;

  async function checkModel() {
    const generation = ++healthGeneration.current;
    healthRequest.current?.abort();
    const controller = new AbortController(); healthRequest.current = controller;
    setChecking(true); setError('');
    try {
      const health = await requestAnalysis('/health', null, { method: 'GET', signal: controller.signal });
      if (mounted.current && generation === healthGeneration.current) {
        setModel(health.torso_model || { ready: false, message: 'Restart the updated analysis service.' });
      }
    } catch (failure) {
      if (mounted.current && generation === healthGeneration.current) setError(failure.message);
    } finally {
      if (mounted.current && generation === healthGeneration.current) { setChecking(false); healthRequest.current = null; }
    }
  }

  useEffect(() => {
    mounted.current = true;
    checkModel();
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active'); setReady(false);
      if (state === 'active') getPermission().catch(() => {});
    });
    return () => {
      mounted.current = false; healthGeneration.current += 1;
      healthRequest.current?.abort(); analysisRequest.current?.abort(); listener.remove();
      removeTemporaryPhoto(photoRef.current); removeTemporaryPhoto(originalRef.current);
      if (editorRef.current?.source.uri !== originalRef.current?.uri) removeTemporaryPhoto(editorRef.current?.source);
    };
  }, [getPermission]);

  function validateSetup() {
    if (!Number.isInteger(Number(age)) || Number(age) < 18 || Number(age) > 99) {
      setError('This prototype is for adults. Enter your age in years.'); return false;
    }
    if (!confirmed) { setError('Confirm that you understand the prototype’s training population.'); return false; }
    if (!model?.ready) { setError('Connect to a trained model before choosing a photo.'); return false; }
    return true;
  }

  function discardCurrent() {
    removeTemporaryPhoto(photoRef.current); removeTemporaryPhoto(originalRef.current);
    photoRef.current = null; originalRef.current = null;
    setPhoto(null); setResult(null); setError(''); setReady(false);
  }

  function openCamera() {
    if (unavailable || !validateSetup()) return;
    discardCurrent(); setStage('camera');
  }

  async function enableCamera() {
    try { if (permission?.canAskAgain) await askPermission(); else await Linking.openSettings(); }
    catch { setError('Enable camera access in your phone settings. You can also choose a photo from your library.'); }
  }

  async function prepareEditor(asset, sourceType) {
    let normalized;
    try { normalized = await normalizePhoto(asset); }
    finally { removeTemporaryPhoto(asset); }
    if (!mounted.current) { removeTemporaryPhoto(normalized); return; }
    const pending = { source: { ...normalized, sourceType }, initialCrop: null, initialRatio: .75 };
    editorRef.current = pending; setEditor(pending); setReady(false);
  }

  async function chooseLibrary() {
    if (mediaLock.current || analysisLock.current || checking || !validateSetup()) return;
    mediaLock.current = true; setMediaBusy(true); setError(''); setLibraryPermissionError(false);
    try {
      // The system picker grants access to the chosen item without requiring camera access.
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false,
        quality: 1, exif: false, base64: false,
      });
      if (!picked.canceled && picked.assets?.[0]) await prepareEditor(picked.assets[0], 'library');
    } catch (failure) {
      if (mounted.current) {
        setLibraryPermissionError(/permission|denied|access/i.test(failure.message));
        setError(failure.message || 'Could not open this photo. Try another image from your library.');
      }
    } finally {
      mediaLock.current = false; if (mounted.current) setMediaBusy(false);
    }
  }

  async function capture() {
    if (mediaLock.current || !camera.current || !ready || !active) return;
    mediaLock.current = true; setMediaBusy(true); setError('');
    let captured;
    try {
      captured = await camera.current.takePictureAsync({ quality: .9, exif: false });
      if (!mounted.current) { removeTemporaryPhoto(captured); return; }
      await prepareEditor(captured, 'camera');
    } catch (failure) {
      removeTemporaryPhoto(captured);
      if (mounted.current) setError(failure.message || 'Could not capture this photo. Please try again.');
    } finally {
      mediaLock.current = false; if (mounted.current) setMediaBusy(false);
    }
  }

  function editPhoto() {
    if (unavailable || !originalRef.current || !photoRef.current) return;
    const pending = { source: originalRef.current,
      initialCrop: photoRef.current.editCrop, initialRatio: photoRef.current.editRatio };
    editorRef.current = pending; setEditor(pending); setError('');
  }

  function cancelEditor() {
    const pending = editorRef.current;
    if (pending?.source.uri !== originalRef.current?.uri) removeTemporaryPhoto(pending?.source);
    editorRef.current = null; setEditor(null); setReady(false);
  }

  function acceptCrop(cropped) {
    const pending = editorRef.current;
    if (!pending || !mounted.current) { removeTemporaryPhoto(cropped); return; }
    const nextOriginal = { ...cropped.editSource, sourceType: pending.source.sourceType };
    if (originalRef.current?.uri !== nextOriginal.uri) removeTemporaryPhoto(originalRef.current);
    if (pending.source.uri !== nextOriginal.uri) removeTemporaryPhoto(pending.source);
    removeTemporaryPhoto(photoRef.current);
    const next = { ...cropped, sourceType: nextOriginal.sourceType };
    originalRef.current = nextOriginal; photoRef.current = next;
    editorRef.current = null;
    setPhoto(next); setResult(null); setError(''); setEditor(null); setStage('review');
  }

  async function analyze() {
    if (analysisLock.current || mediaLock.current || !photo || !validateSetup()) return;
    analysisLock.current = true;
    const controller = new AbortController(); analysisRequest.current = controller;
    setBusy(true); setError('');
    try {
      const response = await requestAnalysis('/torso', {
        image_base64: photo.base64, age: Number(age), male_population_confirmed: confirmed,
      }, { signal: controller.signal });
      if (mounted.current) setResult(response);
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally {
      analysisLock.current = false;
      if (mounted.current) { setBusy(false); analysisRequest.current = null; }
    }
  }

  return <>
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Text style={ui.eyebrow}>BODY FAT TRACKER · PHOTO RESEARCH</Text>
      <Text style={ui.title}>{result?.estimate_percent != null ? 'Appearance estimate' : 'Torso photo'}</Text>
      {stage === 'setup' ? <>
        <Text style={ui.text}>Take a new photo or choose one from your library, then crop and position your torso before analysis.</Text>
        <Notice>This is an experimental appearance-based estimate. It is not a measured body-fat percentage.</Notice>
        <View style={ui.panel}>
          {checking ? <ActivityIndicator color={colors.accent} /> : <>
            <Text style={ui.heading}>{model?.ready ? 'Model connected' : 'Model unavailable'}</Text>
            <Text style={ui.text}>{model?.ready ? `Training source: ${sourceNames[model.label_source] || model.label_source}` : model?.message || 'Keep the Python and Expo servers running.'}</Text>
            {model?.ready && <Text style={ui.small}>Frontal male-torso images only. Actual body-fat accuracy is not established.</Text>}
            {model?.ready && !model.participant_independence_verified && <Text style={ui.small}>Testing on entirely new people has not been verified.</Text>}
            {model?.noncommercial_only && <Text style={ui.small}>Noncommercial research use only.</Text>}
          </>}
          <Button secondary disabled={unavailable} onPress={checkModel}>Refresh model status</Button>
        </View>
        <Field label="Age in years" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} placeholder="18 or older" />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }}
          onPress={() => setConfirmed(value => !value)} style={styles.confirm}>
          <Text style={{ color: colors.accent, fontSize: 22 }}>{confirmed ? '☑' : '☐'}</Text>
          <Text style={[ui.text, { flex: 1 }]}>I understand this prototype was trained only on male-torso images and may not apply to other populations.</Text>
        </Pressable>
        <Text style={ui.text}>Face forward with shoulders, hips and upper thighs visible. Keep the abdomen unobstructed and your arms slightly away from your torso.</Text>
        <Text style={ui.small}>Only the crop you approve is sent to your computer when you tap Analyze. Your library original is never modified.</Text>
        <Button disabled={!model?.ready || unavailable} onPress={chooseLibrary}>{mediaBusy ? 'Opening photo…' : 'Choose from photo library'}</Button>
        <Button secondary disabled={!model?.ready || unavailable} onPress={openCamera}>Take a photo</Button>
      </> : stage === 'review' && photo ? <>
        <Image source={{ uri: photo.uri }} resizeMode="contain" style={styles.photo} />
        <Text style={ui.small}>{photo.sourceType === 'library' ? 'From your photo library' : 'Taken with your camera'} · cropped and ready</Text>
        {!result && <Text style={ui.text}>Keep both shoulders and hips visible. Adjust the crop if needed before uploading it for analysis.</Text>}
        {!result && <Button disabled={unavailable} onPress={analyze}>{busy ? 'Analyzing photo…' : 'Analyze this photo'}</Button>}
        {result?.estimate_percent != null ? <View style={ui.panel}>
          <Text style={styles.value}>≈ {Math.round(result.estimate_percent)}%</Text>
          <Text style={ui.text}>{result.message}</Text>
          <Text style={ui.small}>Source-label spread: {result.source_label_range[0]}–{result.source_label_range[1]}%</Text>
          <Text style={ui.small}>{result.range_note}</Text>
          <Text style={ui.small}>Training source: {sourceNames[result.label_source]}</Text>
        </View> : result ? <Notice>{result.message}</Notice> : null}
        <Button secondary disabled={unavailable} onPress={editPhoto}>Adjust crop, zoom & rotation</Button>
        <Button secondary disabled={unavailable} onPress={chooseLibrary}>Choose another library photo</Button>
        <Button secondary disabled={unavailable} onPress={openCamera}>Take a new photo</Button>
      </> : <>
        <View style={styles.frame}>
          {!permission ? <ActivityIndicator color={colors.accent} /> : !permission.granted ? <View style={styles.center}>
            <Text style={ui.text}>Allow camera access, or choose a photo from your library below.</Text>
            <Button onPress={enableCamera}>{permission.canAskAgain ? 'Enable camera' : 'Open settings'}</Button>
          </View> : cameraError ? <View style={styles.center}>
            <Text style={ui.text}>Camera unavailable. Use a physical device or choose a library photo.</Text>
            <Button onPress={() => { setCameraError(false); setReady(false); setAttempt(value => value + 1); }}>Retry camera</Button>
          </View> : active && !editor ? <>
            <CameraView ref={camera} key={`${facing}-${attempt}`} facing={facing} mirror={facing === 'front'}
              style={StyleSheet.absoluteFill} mode="picture" onCameraReady={() => setReady(true)}
              onMountError={() => { setCameraError(true); setReady(false); }} />
            <Svg viewBox="0 0 300 400" pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Path d="M80 50 L110 40 M190 40 L220 50 M80 50 L60 115 L85 130 L100 90 L105 200 L85 340 L125 350 L150 235 L175 350 L215 340 L195 200 L200 90 L215 130 L240 115 L220 50"
                fill="none" stroke="#d8f5c8" strokeWidth="2" strokeDasharray="8 6" strokeLinecap="round" />
            </Svg>
            <Text style={styles.caption}>Shoulders to upper thighs · stand relaxed</Text>
          </> : <Text style={ui.text}>Camera paused</Text>}
        </View>
        <Button disabled={unavailable || !ready || !active} onPress={capture}>{mediaBusy ? 'Preparing photo…' : 'Capture & adjust photo'}</Button>
        <Button secondary disabled={unavailable} onPress={() => { setFacing(value => value === 'back' ? 'front' : 'back'); setReady(false); }}>Flip camera</Button>
        <Button secondary disabled={unavailable} onPress={chooseLibrary}>Choose from photo library</Button>
      </>}
      {!!error && <Notice>{error}</Notice>}
      {libraryPermissionError && <Button secondary onPress={() => Linking.openSettings().catch(() => setError('Open your phone settings to review photo access.'))}>Open photo access settings</Button>}
      {stage !== 'setup' && <Button secondary disabled={unavailable} onPress={() => { discardCurrent(); setStage('setup'); }}>Back to setup</Button>}
    </ScrollView>
    {editor && <ImageCropper source={editor.source} initialCrop={editor.initialCrop} initialRatio={editor.initialRatio}
      onCancel={cancelEditor} onSave={acceptCrop} />}
  </>;
}

const styles = StyleSheet.create({
  confirm: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 },
  frame: { width: '100%', aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: colors.panel },
  center: { padding: 20, gap: 16 },
  photo: { width: '100%', height: 390, borderRadius: 20, backgroundColor: '#050805' },
  caption: { position: 'absolute', bottom: 16, color: colors.text, backgroundColor: '#101510bb', padding: 9, borderRadius: 12, fontSize: 12 },
  value: { color: colors.accent, fontSize: 64, fontWeight: '600' },
});
