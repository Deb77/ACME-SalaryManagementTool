/** True when the file name ends with one of the comma-separated extensions in `accept`. */
export function hasAcceptedExtension(fileName: string, accept: string): boolean {
  const name = fileName.toLowerCase();
  return accept
    .split(',')
    .map((ext) => ext.trim().toLowerCase())
    .some((ext) => ext !== '' && name.endsWith(ext));
}
