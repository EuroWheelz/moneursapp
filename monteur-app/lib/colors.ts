/** EuroWheelz huisstijl — gedeeld tussen alle schermen */
export const Colors = {
  green: '#345022',
  greenDark: '#263B18',
  greenLight: '#EBF1E6',
  amber: '#F3A713',
  amberDark: '#D4900E',
  amberLight: '#FEF3D6',
  background: '#F2F4F0',
  white: '#FFFFFF',
  textDark: '#1A1A1A',
  textMedium: '#4B5563',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  borderDark: '#D1D5DB',

  // Status kleuren
  statusIngepland: { bg: '#EFF6FF', text: '#1D4ED8' },
  statusOnderweg: { bg: '#EDE9FE', text: '#5B21B6' },
  statusUitgevoerd: { bg: '#FEF3D6', text: '#92400E' },

  // Prioriteit
  prio1: '#EF4444',  // urgent
  prio2: '#F97316',  // hoog
  prio3: '#6B7280',  // normaal

  // Opdracht types
  typeKleuren: {
    onderhoud: { bg: '#DBEAFE', text: '#1E40AF' },
    reparatie: { bg: '#FFEDD5', text: '#9A3412' },
    accu: { bg: '#FEF3D6', text: '#92400E' },
    plaatsen: { bg: '#DCFCE7', text: '#166534' },
    terughalen: { bg: '#FCE7F3', text: '#9D174D' },
    evaluatie: { bg: '#EDE9FE', text: '#5B21B6' },
    voertuigruil: { bg: '#CFFAFE', text: '#155E75' },
    pechhulp: { bg: '#FEE2E2', text: '#991B1B' },
  } as Record<string, { bg: string; text: string }>,
};
