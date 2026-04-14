import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ReportModal from './ReportModal';

jest.mock('../api', () => ({
  API_USER_MESSAGE: 'Something went wrong, please try again',
  createReport: jest.fn().mockResolvedValue({ reportId: 'r1', status: 'OPEN' }),
  REPORT_REASONS: ['HARASSMENT', 'SPAM', 'OTHER'],
  REPORT_REASON_LABELS: { HARASSMENT: 'Harassment', SPAM: 'Spam', OTHER: 'Other' },
  CreateReportPayload: {},
}));

describe('ReportModal', () => {
  it('renders when visible', () => {
    render(
      <ReportModal
        visible
        onClose={jest.fn()}
        podId="pod1"
        podOnly
      />
    );
    expect(screen.getByText('Report pod')).toBeTruthy();
    expect(screen.getByText('Submit Report')).toBeTruthy();
  });

  it('calls onClose when close button pressed', () => {
    const onClose = jest.fn();
    render(
      <ReportModal visible onClose={onClose} podId="pod1" podOnly />
    );
    fireEvent.press(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error when submitting without reason', async () => {
    const { createReport } = require('../api');
    render(
      <ReportModal visible onClose={jest.fn()} podId="pod1" podOnly />
    );
    fireEvent.press(screen.getByText('Submit Report'));
    expect(createReport).not.toHaveBeenCalled();
  });
});
