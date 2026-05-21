// Vite-specific `?worker` query — consumers must use Vite to bundle this package.
declare module "*?worker" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}
