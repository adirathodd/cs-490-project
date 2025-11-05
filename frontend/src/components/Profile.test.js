import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Create mocks inside factories so jest.mock hoisting won't reference uninitialized variables.
jest.mock('../context/AuthContext', () => {
  const actual = jest.requireActual('../context/AuthContext');
  return { ...actual, useAuth: jest.fn() };
});

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: jest.fn(), useParams: jest.fn() };
});

jest.mock('../services/api', () => ({
  authAPI: { getCurrentUser: jest.fn(), getProfilePicture: jest.fn() },
  profileAPI: { getUserProfile: jest.fn() },
}));

import Profile from './Profile';
// Import the created mocks so we can control them in tests
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { authAPI, profileAPI } from '../services/api';

describe('Profile component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // default params: no userId
    useParams.mockReturnValue({ userId: undefined });
  });

  test('redirects to /login when no currentUser', async () => {
    useAuth.mockReturnValue({ currentUser: null, userProfile: null });
    const mockNav = jest.fn();
    useNavigate.mockReturnValue(mockNav);

    render(<Profile />);

    await waitFor(() => expect(mockNav).toHaveBeenCalledWith('/login'));
  });

  test('renders own profile and fetches profile picture, buttons navigate', async () => {
    const profile = {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      city: 'Townsville',
      state: 'TS',
      job_title: 'Engineer',
      headline: 'Senior Engineer',
      summary: 'Work summary',
      industry: 'Software',
      experience_level: 'senior',
    };

    useAuth.mockReturnValue({ currentUser: { uid: 'me' }, userProfile: profile });
    authAPI.getProfilePicture.mockResolvedValue({ profile_picture_url: '/media/pic.png' });
    const mockNav = jest.fn();
    useNavigate.mockReturnValue(mockNav);

    render(<Profile />);

    // wait for display name to appear
    await waitFor(() => expect(screen.getByText(/Jane Doe/)).toBeInTheDocument());

    // profile picture should be fetched and rendered
    await waitFor(() => expect(screen.getByAltText(/Jane Doe/)).toBeInTheDocument());
    const img = screen.getByAltText(/Jane Doe/);
    expect(img).toHaveAttribute('src', expect.stringContaining('/media/pic.png'));

    // Buttons: Edit Profile and Dashboard
    const editBtn = screen.getByRole('button', { name: /Edit Profile/i });
    const dashBtn = screen.getByRole('button', { name: /Dashboard/i });

    fireEvent.click(editBtn);
    expect(mockNav).toHaveBeenCalledWith('/profile/edit');

    fireEvent.click(dashBtn);
    expect(mockNav).toHaveBeenCalledWith('/dashboard');
  });

  test('non-admin trying to view another user navigates to /profile', async () => {
    useAuth.mockReturnValue({ currentUser: { uid: 'me' }, userProfile: null });
    useParams.mockReturnValue({ userId: 'other' });
    authAPI.getCurrentUser.mockResolvedValue({ user: { is_staff: false } });
    const mockNav = jest.fn();
    useNavigate.mockReturnValue(mockNav);

    render(<Profile />);

    await waitFor(() => expect(mockNav).toHaveBeenCalledWith('/profile'));
  });

  test('admin can view another user profile', async () => {
    const otherProfile = { first_name: 'Other', last_name: 'User', email: 'other@x.com' };
    useAuth.mockReturnValue({ currentUser: { uid: 'admin' }, userProfile: null });
    useParams.mockReturnValue({ userId: 'other' });
    authAPI.getCurrentUser.mockResolvedValue({ user: { is_staff: true } });
    profileAPI.getUserProfile.mockResolvedValue({ profile: otherProfile });
    useNavigate.mockReturnValue(jest.fn());

    render(<Profile />);

    await waitFor(() => expect(screen.getByText(/Other User/)).toBeInTheDocument());
    // Use queryAllByText to find all elements with the email and verify at least one exists
    const emailElements = screen.queryAllByText(otherProfile.email);
    expect(emailElements.length).toBeGreaterThan(0);
  });

  test('admin profile fetch error displays error message', async () => {
    useAuth.mockReturnValue({ currentUser: { uid: 'admin' }, userProfile: null });
    useParams.mockReturnValue({ userId: 'other' });
    authAPI.getCurrentUser.mockResolvedValue({ user: { is_staff: true } });
    // Simulate API error with nested error.message
    profileAPI.getUserProfile.mockRejectedValue({ error: { message: 'User not found' } });
    const mockNav = jest.fn();
    useNavigate.mockReturnValue(mockNav);

    render(<Profile />);

    // Wait for error message to appear (covers lines 48-49 and error handling)
    await waitFor(() => expect(screen.getByText(/User not found/)).toBeInTheDocument());
    // Verify error state is rendered (covers lines 95-98)
    expect(screen.getByText(/User not found/)).toBeInTheDocument();
  });

  test('profile fetch throws exception displays generic error', async () => {
    useAuth.mockReturnValue({ currentUser: { uid: 'admin' }, userProfile: null });
    useParams.mockReturnValue({ userId: 'other' });
    // Throw an error during getCurrentUser to trigger outer catch (lines 54-55)
    authAPI.getCurrentUser.mockRejectedValue(new Error('Network error'));
    const mockNav = jest.fn();
    useNavigate.mockReturnValue(mockNav);

    render(<Profile />);

    // Wait for error message (covers outer catch block lines 54-55)
    await waitFor(() => expect(screen.getByText(/Error loading profile: Network error/)).toBeInTheDocument());
  });

  test('error state shows error message and back button', async () => {
    // Setup: when admin tries to view a user but gets an error that isn't caught by inner try-catch
    // This triggers the outer catch block which sets error with "Error loading profile: " prefix
    useAuth.mockReturnValue({ currentUser: { uid: 'admin' }, userProfile: null });
    useParams.mockReturnValue({ userId: 'other' });
    // Make getCurrentUser throw to trigger outer catch (line 54-55)
    authAPI.getCurrentUser.mockRejectedValue(new Error('Access denied'));
    const mockNav = jest.fn();
    useNavigate.mockReturnValue(mockNav);

    render(<Profile />);

    // Wait for error message to appear (covers outer catch block and error state rendering)
    await waitFor(() => expect(screen.getByText(/Error loading profile: Access denied/)).toBeInTheDocument());

    // Verify error page is rendered with back button (covers lines 95-98)
    const backBtn = screen.getByRole('button', { name: /Back to Dashboard/i });
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);
    expect(mockNav).toHaveBeenCalledWith('/dashboard');
  });
});
