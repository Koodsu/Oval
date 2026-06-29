import React from 'react';
import { Text, View } from 'react-native';
import { AppBackdrop, Button } from './ui';
import { spacing, useTheme } from '../theme';
import { captureException } from '../lib/monitoring';

function Fallback({ onReset }: { onReset: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <AppBackdrop>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
        <Text style={typography.title}>Something went wrong</Text>
        <Text style={[typography.body, { color: colors.sub }]}>
          The app hit an unexpected error. Try again — if it keeps happening, fully close and reopen
          the app.
        </Text>
        <Button label="Try again" icon="refresh" onPress={onReset} />
      </View>
    </AppBackdrop>
  );
}

interface State {
  hasError: boolean;
}

/** Top-level boundary so a render error shows a recover screen instead of a white crash. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    captureException(error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return <Fallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}
