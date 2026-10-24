import { useEffect, useMemo, useState } from 'react';
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

const segmentColors = [
  '#353535', '#666666', '#929292', '#b5b5b5', '#77736d', '#aaa59c',
  '#4b5052', '#8a8d8d', '#c9c7c2', '#5d5751', '#9a948c', '#d8d6d1'
];
const colorForSegment = index => segmentColors[index] || `hsl(40 3% ${30 + ((index * 17) % 48)}%)`;

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = event => setReducedMotion(event.matches);
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return reducedMotion;
}

export default function ExpenseDistributionChart({ items, total, money }) {
  const reducedMotion = usePrefersReducedMotion();
  const labels = useMemo(() => items.map(([category]) => category), [items]);
  const amounts = useMemo(() => items.map(([, amount]) => amount), [items]);
  const colors = useMemo(() => items.map((_, index) => colorForSegment(index)), [items]);

  const data = useMemo(() => ({
    labels,
    datasets: [{
      data: amounts,
      backgroundColor: colors,
      borderColor: '#f3f3f1',
      borderWidth: 2,
      borderAlign: 'inner',
      hoverOffset: 3
    }]
  }), [labels, amounts, colors]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
    cutout: '70%',
    rotation: -90,
    animation: reducedMotion ? false : {
      duration: 1050,
      easing: 'easeOutQuart',
      animateRotate: true,
      animateScale: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#191919',
        borderColor: '#f3f3f1',
        borderWidth: 1,
        padding: 8,
        caretSize: 4,
        cornerRadius: 0,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 4,
        titleFont: { family: 'Consolas, monospace', size: 11, weight: 'bold' },
        bodyFont: { family: 'Arial, sans-serif', size: 11 },
        callbacks: {
          label(context) {
            const amount = Number(context.raw) || 0;
            const percentage = total > 0 ? (amount / total) * 100 : 0;
            return `${money.format(amount)} (${percentage.toFixed(1)}%)`;
          }
        }
      }
    }
  }), [money, reducedMotion, total]);

  return (
    <div className="distribution-layout">
      <div className="distribution-chart-column">
        <div className="donut-frame" role="img" aria-label={`Expense distribution. Total spending ${money.format(total)}.`}>
          <Doughnut className="donut-canvas" data={data} options={options} aria-hidden="true" />
          <div className="donut-center" aria-hidden="true">
            <strong>{money.format(total)}</strong>
            <span>Total spending</span>
          </div>
        </div>
      </div>
      <ul className="donut-legend" aria-label="Expense totals by category">
        {items.map(([category, amount], index) => (
          <li className="donut-legend-row" key={category} style={{ '--reveal-delay': `${index * 90}ms` }}>
            <span className="donut-legend-swatch" style={{ backgroundColor: colors[index] }} aria-hidden="true" />
            <span className="donut-legend-name">{category}</span>
            <strong className="donut-legend-amount">{money.format(amount)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
