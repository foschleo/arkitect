
import { Unit } from '../types';
import { UNITS_PER_METER } from '../constants';

export const convertValueToWorldUnits = (value: number, unit: Unit): number => {
  if (isNaN(value)) return 0;
  switch (unit) {
    case Unit.Meters: return value * UNITS_PER_METER;
    case Unit.Centimeters: return value; // Internally, 1 unit = 1 cm
    case Unit.Millimeters: return value / 10;
    default: return value * UNITS_PER_METER;
  }
};

export const convertWorldUnitsToDisplayUnit = (worldValue: number, unit: Unit): number => {
  if (isNaN(worldValue)) return 0;
  switch (unit) {
    case Unit.Meters: return worldValue / UNITS_PER_METER;
    case Unit.Centimeters: return worldValue;
    case Unit.Millimeters: return worldValue * 10;
    default: return worldValue / UNITS_PER_METER;
  }
};
