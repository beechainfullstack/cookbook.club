export const theme = {
  colors: {
    background: '#FAF9F6', paper: '#FFFFFF', ink: '#263C30', muted: '#72766B',
    line: '#E7E7DE', green: '#2D513B', lime: '#D8EA99', lightGreen: '#EEF3E5',
    peach: '#F4DDCD', yellow: '#F3EBC9', lavender: '#E8E2F3', red: '#A04338',
  },
  fonts: { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_600SemiBold', display: 'Fraunces_500Medium' },
};

export const flavorTheme = {
  art: { color: '#87523F', background: '#F9EBDF', icon: 'color-palette-outline' },
  sports: { color: '#4C6A38', background: '#EBF0DC', icon: 'basketball-outline' },
  style: { color: '#795375', background: '#F2E8F1', icon: 'shirt-outline' },
  music: { color: '#5F648B', background: '#EAEBF7', icon: 'sparkles-outline' },
  ideas: { color: '#89712F', background: '#F9F1D8', icon: 'school-outline' },
  kindness: { color: '#9A5B62', background: '#F9E9E9', icon: 'heart-outline' },
} as const;
