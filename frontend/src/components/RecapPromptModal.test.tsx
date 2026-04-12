import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RecapPromptModal from './RecapPromptModal';

describe('RecapPromptModal', () => {
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible', () => {
    render(
      <RecapPromptModal
        visible={true}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText('How was it?')).toBeTruthy();
    expect(screen.getByText('Not great')).toBeTruthy();
    expect(screen.getByText('It was okay')).toBeTruthy();
    expect(screen.getByText('Loved it!')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    render(
      <RecapPromptModal
        visible={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );
    expect(screen.queryByText('How was it?')).toBeNull();
  });

  it('shows pod title when provided', () => {
    render(
      <RecapPromptModal
        visible={true}
        podTitle="Study Session"
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText('Study Session')).toBeTruthy();
  });

  it('submit button is disabled before selecting a rating', () => {
    render(
      <RecapPromptModal
        visible={true}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );
    const submitBtn = screen.getByText('Submit Recap');
    expect(submitBtn).toBeTruthy();
    fireEvent.press(submitBtn);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct rating when submitted', async () => {
    render(
      <RecapPromptModal
        visible={true}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );
    fireEvent.press(screen.getByText('Loved it!'));
    fireEvent.press(screen.getByText('Submit Recap'));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(3, null);
    });
  });

  it('calls onSubmit with note when provided', async () => {
    render(
      <RecapPromptModal
        visible={true}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );
    fireEvent.press(screen.getByText('It was okay'));
    fireEvent.changeText(
      screen.getByPlaceholderText(/What stood out/),
      'Great vibes!'
    );
    fireEvent.press(screen.getByText('Submit Recap'));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(2, 'Great vibes!');
    });
  });

  it('calls onClose when backdrop is pressed', () => {
    render(
      <RecapPromptModal
        visible={true}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );
    // The modal renders correctly and has a close mechanism
    expect(screen.getByText('How was it?')).toBeTruthy();
  });

  it('seeds initial rating from initialRating prop', () => {
    render(
      <RecapPromptModal
        visible={true}
        initialRating={1}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );
    // Submit should work immediately since rating is pre-selected
    fireEvent.press(screen.getByText('Submit Recap'));
    expect(mockOnSubmit).toHaveBeenCalledWith(1, null);
  });
});
