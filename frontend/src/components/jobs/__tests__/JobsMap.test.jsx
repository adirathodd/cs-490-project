// Define mocks BEFORE importing the component under test
// Mock geoAPI used by JobsMap
jest.mock('../../services/api', () => ({
  geoAPI: {
    jobsGeo: jest.fn(async () => ({ jobs: [] }))
  }
}), { virtual: true });

// Use global leaflet mock from moduleNameMapper; no local mock here

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import JobsMap from '../JobsMap';
// Use a local mock and inject via props to avoid path mocking fragility
const mockGeoAPI = { jobsGeo: jest.fn(async () => ({ jobs: [] })) };

describe('JobsMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading then renders map container on success', async () => {
    const { container } = render(<JobsMap services={{ geoAPI: mockGeoAPI }} />);
    // Loading should appear first
    await screen.findByText(/Loading map/i);
    // Then disappear after fetch completes
    await waitFor(() => expect(screen.queryByText(/Loading map/i)).not.toBeInTheDocument());
    // Map container should be present
    const mapDiv = container.querySelector('.jobs-map div');
    expect(mapDiv).toBeInTheDocument();

    // Leaflet was initialized
    const L = require('leaflet');
    expect(L.map).toHaveBeenCalled();
    expect(L.tileLayer).toHaveBeenCalled();
    const createdMap = L.map.mock.results[0]?.value;
    expect(createdMap.setView).toHaveBeenCalled();
  });

  test('renders markers for jobs with lat/lon and home marker', async () => {
    mockGeoAPI.jobsGeo.mockResolvedValueOnce({
      jobs: [
        { id: 1, company: 'A', title: 'Engineer', location: 'NY', lat: 40.7, lon: -74.0 },
        { id: 2, company: 'B', title: 'Analyst', location: 'NJ', lat: 40.8, lon: -74.2 },
        { id: 3, company: 'C', title: 'NoCoords', location: 'NA' },
      ]
    });

    render(<JobsMap services={{ geoAPI: mockGeoAPI }} home={{ lat: 40.6, lon: -73.9 }} />);
    await waitFor(() => expect(screen.queryByText(/Loading map/i)).not.toBeInTheDocument());

    const L = require('leaflet');
    // Two job markers + one home marker calls
    expect(L.marker).toHaveBeenCalledTimes(3);
    // Last created marker should have bindPopup called
    const lastMarker = L.marker.mock.results[L.marker.mock.results.length - 1]?.value;
    expect(lastMarker.bindPopup).toHaveBeenCalled();
    const createdMap = L.map.mock.results[0]?.value;
    expect(createdMap.setView).toHaveBeenCalled();
  });

  test('shows error banner on API failure', async () => {
    mockGeoAPI.jobsGeo.mockRejectedValueOnce(new Error('fail'));

    render(<JobsMap services={{ geoAPI: mockGeoAPI }} />);
    await waitFor(() => screen.getByText(/Failed to load jobs map/i));
    expect(screen.getByText(/Failed to load jobs map/i)).toBeInTheDocument();
  });

  test('re-fetches when filters change', async () => {
    mockGeoAPI.jobsGeo.mockResolvedValue({ jobs: [] });

    const { rerender } = render(<JobsMap services={{ geoAPI: mockGeoAPI }} filters={{ status: 'applied' }} />);
    await waitFor(() => expect(mockGeoAPI.jobsGeo).toHaveBeenCalledTimes(1));

    rerender(<JobsMap services={{ geoAPI: mockGeoAPI }} filters={{ status: 'interview' }} />);
    await waitFor(() => expect(mockGeoAPI.jobsGeo).toHaveBeenCalledTimes(2));
  });

  test('centers on first job with coords, otherwise default', async () => {
    mockGeoAPI.jobsGeo.mockResolvedValueOnce({ jobs: [] });

    render(<JobsMap services={{ geoAPI: mockGeoAPI }} />);
    await waitFor(() => expect(screen.queryByText(/Loading map/i)).not.toBeInTheDocument());
    // Default center applied
    const L = require('leaflet');
    const createdMap = L.map.mock.results[0]?.value;
    expect(createdMap.setView).toHaveBeenCalledWith(expect.arrayContaining([40.71, -74.01]), 4);

    // Now with a job having coords
    jest.clearAllMocks();
    mockGeoAPI.jobsGeo.mockResolvedValueOnce({ jobs: [{ id: 1, company: 'X', title: 'Y', location: 'Z', lat: 41, lon: -75 }] });
    render(<JobsMap services={{ geoAPI: mockGeoAPI }} />);
    await waitFor(() => {
      const L2 = require('leaflet');
      const createdMap2 = L2.map.mock.results[0]?.value;
      expect(createdMap2.setView).toHaveBeenCalled();
    });
    // Check that setView received center derived from job
    const L3 = require('leaflet');
    const createdMap3 = L3.map.mock.results[0]?.value;
    const call = createdMap3.setView.mock.calls.find(c => Array.isArray(c[0]));
    expect(call[0]).toEqual([41, -75]);
  });
});
