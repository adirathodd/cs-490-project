import React from 'react';

// Mock all Material-UI icons
const createMockIcon = (name) => {
  return function MockIcon(props) {
    return <span data-testid={`icon-${name}`} {...props}>{name}</span>;
  };
};

export const Refresh = createMockIcon('Refresh');
export const CheckCircle = createMockIcon('CheckCircle');
export const Error = createMockIcon('Error');
export const Warning = createMockIcon('Warning');
export const Info = createMockIcon('Info');
export const TrendingUp = createMockIcon('TrendingUp');
export const TrendingDown = createMockIcon('TrendingDown');
export const ExpandMore = createMockIcon('ExpandMore');
export const ExpandLess = createMockIcon('ExpandLess');
export const Close = createMockIcon('Close');
export const CheckCircleOutline = createMockIcon('CheckCircleOutline');
export const ErrorOutline = createMockIcon('ErrorOutline');
export const WarningAmber = createMockIcon('WarningAmber');
export const InfoOutlined = createMockIcon('InfoOutlined');
export const Schedule = createMockIcon('Schedule');
export const Speed = createMockIcon('Speed');
export const Assessment = createMockIcon('Assessment');
export const NotificationsActive = createMockIcon('NotificationsActive');
