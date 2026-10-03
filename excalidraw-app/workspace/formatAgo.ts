export const formatAgo = (iso: string) => {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) {
    return "just now";
  }
  if (seconds < 5400) {
    return `${Math.round(seconds / 60)} min ago`;
  }
  if (seconds < 129600) {
    return `${Math.round(seconds / 3600)} h ago`;
  }
  return `${Math.round(seconds / 86400)} d ago`;
};
