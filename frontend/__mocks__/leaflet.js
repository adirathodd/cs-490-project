const mockMap = {
  setView: jest.fn(() => mockMap),
  eachLayer: jest.fn(() => {}),
  removeLayer: jest.fn(),
  invalidateSize: jest.fn(),
};

const mockTileLayer = {
  addTo: jest.fn(() => mockTileLayer),
};

const mockMarker = {
  addTo: jest.fn(() => mockMarker),
  bindPopup: jest.fn(() => mockMarker),
};

module.exports = {
  map: jest.fn(() => mockMap),
  tileLayer: jest.fn(() => mockTileLayer),
  marker: jest.fn(() => mockMarker),
  icon: jest.fn((opts) => ({ opts })),
  TileLayer: function TileLayer() {},
};
