const mockMap = {
  setView: jest.fn(() => mockMap),
  eachLayer: jest.fn(fn => {}),
  removeLayer: jest.fn(),
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
  TileLayer: function TileLayer() {},
};
