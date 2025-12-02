const React = require('react');

module.exports = {
	ResponsiveContainer: ({ children }) => React.createElement('div', null, children),
	LineChart: ({ children }) => React.createElement('div', null, children),
	BarChart: ({ children }) => React.createElement('div', null, children),
	PieChart: ({ children }) => React.createElement('div', null, children),
	Line: () => null,
	Bar: () => null,
	Pie: () => null,
	XAxis: () => null,
	YAxis: () => null,
	Tooltip: () => null,
	Legend: () => null,
	CartesianGrid: () => null,
};
