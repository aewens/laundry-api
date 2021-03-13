export default function padInt(num: number, len = 0): string {
  return num.toFixed(0).padStart(len, '0');
}
