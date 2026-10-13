import { StyleSheet } from 'react-native';

export const colors = { bg: '#101418', card: '#1b2229', text: '#f2f5f7', dim: '#8b98a3', accent: '#4aa3ff' };

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 56 },
  h1: { color: colors.text, fontSize: 24, fontWeight: '600', marginBottom: 12 },
  p: { color: colors.dim, fontSize: 15, lineHeight: 21, marginBottom: 12 },
  label: { color: colors.text, fontSize: 15, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: 8, padding: 12, fontSize: 16 },
  btn: { backgroundColor: colors.accent, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 12 },
  btnAlt: { backgroundColor: colors.card },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
});
