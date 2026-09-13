import { WeekSchedule, SessionItem } from './types';

export const DEFAULT_SESSIONS: SessionItem[] = [
  {
    id: 's1',
    title: 'فهم وشرح',
    type: 'study',
    startTime: '08:00',
    endTime: '09:00',
    durationMinutes: 60,
  },
  {
    id: 's2',
    title: 'راحة',
    type: 'break',
    startTime: '09:00',
    endTime: '09:15',
    durationMinutes: 15,
  },
  {
    id: 's3',
    title: 'حل أسئلة',
    type: 'study',
    startTime: '09:15',
    endTime: '10:15',
    durationMinutes: 60,
  },
  {
    id: 's4',
    title: 'راحة',
    type: 'break',
    startTime: '10:15',
    endTime: '10:30',
    durationMinutes: 15,
  },
  {
    id: 's5',
    title: 'مراجعة الأخطاء',
    type: 'study',
    startTime: '10:30',
    endTime: '11:00',
    durationMinutes: 30,
  },
];

export const ARABIC_DAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function getDefaultSchedule(): WeekSchedule {
  return {
    0: {
      dayOfWeek: 0,
      dayName: 'الأحد',
      subject: 'قدرات كمي',
      isRest: false,
      sessions: JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
    },
    1: {
      dayOfWeek: 1,
      dayName: 'الاثنين',
      subject: 'قدرات لفظي',
      isRest: false,
      sessions: JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
    },
    2: {
      dayOfWeek: 2,
      dayName: 'الثلاثاء',
      subject: 'قدرات كمي',
      isRest: false,
      sessions: JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
    },
    3: {
      dayOfWeek: 3,
      dayName: 'الأربعاء',
      subject: 'قدرات لفظي',
      isRest: false,
      sessions: JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
    },
    4: {
      dayOfWeek: 4,
      dayName: 'الخميس',
      subject: 'STEP',
      isRest: false,
      sessions: JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
    },
    5: {
      dayOfWeek: 5,
      dayName: 'الجمعة',
      subject: 'راحة',
      isRest: true,
      sessions: [],
    },
    6: {
      dayOfWeek: 6,
      dayName: 'السبت',
      subject: 'مراجعة كمي + لفظي',
      isRest: false,
      sessions: JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
    },
  };
}
