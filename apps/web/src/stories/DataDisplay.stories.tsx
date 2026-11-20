import type { Story } from '@ladle/react';
import { MoneyText, StatusTag } from '../components';
import { row } from './layout';

export default { title: 'Atoms / Data display' };

export const StatusTags: Story = () => (
  <div style={row}>
    <StatusTag tone="success" dot>
      Active
    </StatusTag>
    <StatusTag>Terminated</StatusTag>
    <StatusTag tone="info">Merit</StatusTag>
    <StatusTag tone="warning">Needs review</StatusTag>
    <StatusTag tone="danger">Invalid value</StatusTag>
  </div>
);

export const Money: Story = () => (
  <div style={row}>
    <MoneyText amountMinor={324_000_000} currency="INR" strong />
    <MoneyText amountMinor={26_000_000} currency="INR" signed />
    <MoneyText amountMinor={-450_000} currency="GBP" signed />
    <MoneyText amountMinor={9_200_000} currency="USD" />
    <MoneyText amountMinor={4_850_050} currency="EUR" />
    <MoneyText amountMinor={720_000_00} currency="INR" compact />
  </div>
);
