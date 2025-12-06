/**
 * Mock for emailAPI service
 */
const emailAPI = {
  startGmailAuth: jest.fn(),
  completeGmailAuth: jest.fn(),
  getGmailStatus: jest.fn(),
  disconnectGmail: jest.fn(),
  enableScanning: jest.fn(),
  updatePreferences: jest.fn(),
  triggerScan: jest.fn(),
  scanGmailNow: jest.fn(),
  getEmails: jest.fn(),
  getEmailDetail: jest.fn(),
  linkEmailToJob: jest.fn(),
  applyStatusSuggestion: jest.fn(),
  dismissEmail: jest.fn(),
  getScanLogs: jest.fn(),
};

export default emailAPI;
