module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/__mocks__/fileMock.js',
    '^leaflet$': '<rootDir>/__mocks__/leaflet.js',
    '^react-icons/fa$': '<rootDir>/__mocks__/react-icons/fa.js',
    '^rehype-sanitize$': '<rootDir>/src/__mocks__/rehype-sanitize.js',
    '^remark-gfm$': '<rootDir>/src/__mocks__/remark-gfm.js',
    '^react-markdown$': '<rootDir>/src/__mocks__/react-markdown.js',
    '^recharts$': '<rootDir>/__mocks__/recharts.js',
    '^react-chartjs-2$': '<rootDir>/__mocks__/react-chartjs-2.js',
    '^chart.js$': '<rootDir>/__mocks__/chart.js.js',
    '^@fullcalendar/react$': '<rootDir>/__mocks__/FullCalendarReact.js',
    '^@fullcalendar/(daygrid|timegrid|interaction|list)$': '<rootDir>/__mocks__/FullCalendarPlugin.js',
    '^@mui/material$': '<rootDir>/__mocks__/@mui/material.js',
    '^@mui/icons-material$': '<rootDir>/__mocks__/@mui/icons-material.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { 
          targets: { node: 'current' },
          modules: 'commonjs'
        }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },
  transformIgnorePatterns: [
    // Allow transforming these ESM packages which ship modern syntax
    'node_modules/(?!(react-icons|@dnd-kit|react-markdown|rehype-sanitize|remark-gfm|devlop)/)'
  ],
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx}'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/setupTests.js'
  ],
  // Increase timeout for slow tests
  testTimeout: 10000,
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
