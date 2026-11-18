import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const colors = {
  background: '#101510', panel: '#1b241b', accent: '#b9edb0', text: '#f3f5ef',
  muted: '#a9b5a3', border: '#344431', warning: '#e9cf93',
};

export function Button({ children, onPress, secondary, disabled, style }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      onPress={onPress} disabled={disabled}
      style={({ pressed }) => [ui.button, secondary && ui.secondary, (pressed || disabled) && { opacity: .45 }, style]}>
      <Text style={[ui.buttonText, secondary && { color: colors.text }]}>{children}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, ...props }) {
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
      placeholderTextColor="#788573" style={ui.input} {...props} /></View>;
}

export function Notice({ children }) {
  return <View accessibilityLiveRegion="polite" style={ui.notice}><Text style={ui.noticeText}>{children}</Text></View>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 20, paddingBottom: 36 },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: colors.text, fontSize: 32, fontWeight: '600' },
  heading: { color: colors.text, fontSize: 20, fontWeight: '600' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  panel: { backgroundColor: colors.panel, borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  label: { color: colors.text, fontSize: 14, fontWeight: '500' },
  input: { color: colors.text, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1,
    padding: 15, borderRadius: 12, fontSize: 17 },
  button: { backgroundColor: colors.accent, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
  secondary: { backgroundColor: '#263224', borderWidth: 1, borderColor: colors.border },
  buttonText: { color: '#152013', fontSize: 15, fontWeight: '600' },
  notice: { padding: 16, backgroundColor: '#302c1d', borderRadius: 14 },
  noticeText: { color: colors.warning, lineHeight: 21, fontSize: 14 },
});
