/**
 * Nothing, unless an object page is open (§5.77).
 *
 * A parallel slot needs a default or every other route under the workspace would 404 on a reload;
 * this is that default, and it draws nothing.
 */
export default function NoSheet() {
  return null;
}
