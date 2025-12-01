const React = require('react');

function FullCalendar(props) {
	return React.createElement('div', { 'data-testid': 'fullcalendar', ...props });
}

module.exports = FullCalendar;
