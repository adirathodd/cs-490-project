/**
 * Tests for Email API Service (UC-113)
 */
import emailAPI from '../emailAPI';
import { api } from '../api';

jest.mock('../api');

describe('Email API Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startGmailAuth', () => {
    it('should start Gmail OAuth flow', async () => {
      const mockResponse = {
        data: {
          auth_url: 'https://accounts.google.com/auth?...'
        }
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await emailAPI.startGmailAuth('http://localhost:3000/callback', 'state123');

      expect(api.post).toHaveBeenCalledWith('/gmail/oauth/start/', {
        redirect_uri: 'http://localhost:3000/callback',
        state: 'state123'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle errors', async () => {
      api.post.mockRejectedValue(new Error('Network error'));

      await expect(
        emailAPI.startGmailAuth('http://localhost:3000/callback', 'state123')
      ).rejects.toThrow('Network error');
    });
  });

  describe('completeGmailAuth', () => {
    it('should complete Gmail OAuth', async () => {
      const mockResponse = {
        data: {
          success: true,
          gmail_address: 'user@gmail.com'
        }
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await emailAPI.completeGmailAuth('code123', 'state123', 'http://localhost:3000/callback');

      expect(api.post).toHaveBeenCalledWith('/gmail/oauth/callback/', {
        code: 'code123',
        state: 'state123',
        redirect_uri: 'http://localhost:3000/callback'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle OAuth errors', async () => {
      api.post.mockRejectedValue(new Error('Invalid code'));

      await expect(
        emailAPI.completeGmailAuth('invalid', 'state123', 'http://localhost:3000/callback')
      ).rejects.toThrow('Invalid code');
    });
  });

  describe('getGmailStatus', () => {
    it('should get Gmail integration status', async () => {
      const mockResponse = {
        data: {
          connected: true,
          gmail_address: 'user@gmail.com',
          status: 'connected'
        }
      };
      api.get.mockResolvedValue(mockResponse);

      const result = await emailAPI.getGmailStatus();

      expect(api.get).toHaveBeenCalledWith('/gmail/status/');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle disconnected status', async () => {
      const mockResponse = {
        data: {
          connected: false
        }
      };
      api.get.mockResolvedValue(mockResponse);

      const result = await emailAPI.getGmailStatus();

      expect(result.connected).toBe(false);
    });
  });

  describe('disconnectGmail', () => {
    it('should disconnect Gmail integration', async () => {
      const mockResponse = {
        data: {
          message: 'Gmail disconnected'
        }
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await emailAPI.disconnectGmail();

      expect(api.post).toHaveBeenCalledWith('/gmail/disconnect/');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('scanGmailNow', () => {
    it('should trigger manual Gmail scan', async () => {
      const mockResponse = {
        data: {
          message: 'Scan started',
          task_id: 'task123'
        }
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await emailAPI.scanGmailNow();

      expect(api.post).toHaveBeenCalledWith('/gmail/scan-now/');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle scan errors', async () => {
      api.post.mockRejectedValue(new Error('Scan failed'));

      await expect(emailAPI.scanGmailNow()).rejects.toThrow('Scan failed');
    });
  });

  describe('getEmails', () => {
    it('should get application emails', async () => {
      const mockEmails = [
        {
          id: 1,
          subject: 'Interview Invitation',
          sender_email: 'hr@techcorp.com',
          email_type: 'interview_invitation'
        },
        {
          id: 2,
          subject: 'Application Received',
          sender_email: 'careers@company.com',
          email_type: 'acknowledgment'
        }
      ];
      api.get.mockResolvedValue({ data: mockEmails });

      const result = await emailAPI.getEmails();

      expect(api.get).toHaveBeenCalledWith('/emails/', { params: {} });
      expect(result).toEqual(mockEmails);
    });

    it('should filter emails by job', async () => {
      const mockEmails = [
        {
          id: 1,
          subject: 'Interview',
          job_id: 5
        }
      ];
      api.get.mockResolvedValue({ data: mockEmails });

      const result = await emailAPI.getEmails({ job_id: 5 });

      expect(api.get).toHaveBeenCalledWith('/emails/', {
        params: { job_id: 5 }
      });
      expect(result).toEqual(mockEmails);
    });

    it('should filter emails by type', async () => {
      const mockEmails = [
        {
          id: 1,
          email_type: 'interview_invitation'
        }
      ];
      api.get.mockResolvedValue({ data: mockEmails });

      const result = await emailAPI.getEmails({ email_type: 'interview_invitation' });

      expect(api.get).toHaveBeenCalledWith('/emails/', {
        params: { email_type: 'interview_invitation' }
      });
      expect(result).toEqual(mockEmails);
    });
  });

  describe('getEmailDetail', () => {
    it('should get email detail', async () => {
      const mockEmail = {
        id: 1,
        subject: 'Interview Invitation',
        body_preview: 'Full email body...',
        sender_email: 'hr@techcorp.com'
      };
      api.get.mockResolvedValue({ data: mockEmail });

      const result = await emailAPI.getEmailDetail(1);

      expect(api.get).toHaveBeenCalledWith('/emails/1/');
      expect(result).toEqual(mockEmail);
    });

    it('should handle not found error', async () => {
      api.get.mockRejectedValue({ response: { status: 404 } });

      await expect(emailAPI.getEmailDetail(999)).rejects.toEqual({
        response: { status: 404 }
      });
    });
  });

  describe('linkEmailToJob', () => {
    it('should link email to job', async () => {
      const mockResponse = {
        data: {
          message: 'Email linked to job',
          email: { id: 1, job_id: 5 }
        }
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await emailAPI.linkEmailToJob(1, 5);

      expect(api.post).toHaveBeenCalledWith('/emails/1/link/', {
        job_id: 5
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle invalid job error', async () => {
      api.post.mockRejectedValue(new Error('Job not found'));

      await expect(emailAPI.linkEmailToJob(1, 999)).rejects.toThrow('Job not found');
    });
  });

  describe('dismissEmail', () => {
    it('should dismiss email', async () => {
      api.delete.mockResolvedValue({ data: {} });

      await emailAPI.dismissEmail(1);

      expect(api.delete).toHaveBeenCalledWith('/emails/1/');
    });

    it('should handle delete errors', async () => {
      api.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(emailAPI.dismissEmail(1)).rejects.toThrow('Delete failed');
    });
  });

  describe('getScanLogs', () => {
    it('should get scan logs', async () => {
      const mockLogs = [
        {
          id: 1,
          scan_started: '2024-01-01T12:00:00Z',
          emails_found: 10,
          status: 'completed'
        },
        {
          id: 2,
          scan_started: '2024-01-02T12:00:00Z',
          emails_found: 5,
          status: 'completed'
        }
      ];
      api.get.mockResolvedValue({ data: mockLogs });

      const result = await emailAPI.getScanLogs();

      expect(api.get).toHaveBeenCalledWith('/gmail/scan-logs/');
      expect(result).toEqual(mockLogs);
    });

    it('should handle empty logs', async () => {
      api.get.mockResolvedValue({ data: [] });

      const result = await emailAPI.getScanLogs();

      expect(result).toEqual([]);
    });
  });
});
