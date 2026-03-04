// Mock expo-haptics (no-op in tests)
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3 },
}));

// Mock expo-linear-gradient for component tests
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props) => React.createElement(View, props, props.children),
  };
});

// Mock @expo/vector-icons (renders nothing in tests)
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name, ...rest }) => React.createElement(Text, rest, name);
  return {
    Ionicons: Icon,
    MaterialIcons: Icon,
    FontAwesome: Icon,
    Feather: Icon,
  };
});
