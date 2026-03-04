import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Avatar, { AvatarStack } from './Avatar';

describe('Avatar', () => {
  it('renders the first letter of the name', () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('renders an uppercase initial regardless of input case', () => {
    render(<Avatar name="bob" />);
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('renders with a custom size without crashing', () => {
    render(<Avatar name="Carol" size={48} />);
    expect(screen.getByText('C')).toBeTruthy();
  });

  it('renders with isYou flag without crashing', () => {
    render(<Avatar name="Dave" isYou />);
    expect(screen.getByText('D')).toBeTruthy();
  });
});

describe('AvatarStack', () => {
  const members = [
    { id: 'm1', user: { id: 'u1', name: 'Alice' } },
    { id: 'm2', user: { id: 'u2', name: 'Bob' } },
    { id: 'm3', user: { id: 'u3', name: 'Carol' } },
  ];

  it('renders initials for all members', () => {
    render(<AvatarStack members={members} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
  });

  it('respects the max prop and only shows the first N members', () => {
    render(<AvatarStack members={members} max={2} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.queryByText('C')).toBeNull();
  });

  it('renders an empty stack without crashing', () => {
    render(<AvatarStack members={[]} />);
  });
});
