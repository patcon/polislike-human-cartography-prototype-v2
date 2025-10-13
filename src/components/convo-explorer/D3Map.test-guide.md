# D3Map Testing Guide

This guide provides comprehensive testing strategies for the D3Map component to prevent regression of the quick select and paint tool interaction bug.

## The Original Bug

**Problem**: After performing a quick select operation and switching from move to paint mode, the paint tool would malfunction. The lasso drag behavior would interfere with itself, causing paint operations to fail.

**Root Cause**: Complex coordination system between quick select touch handlers and D3 lasso drag behavior created circular interference.

**Solution**: Simplified architecture using unified pointer events with natural click/drag distinction.

## Automated Tests

### Smoke Tests (`D3Map.smoke.test.tsx`)

Basic rendering and prop handling tests that ensure the component doesn't crash:

```bash
npm run test:run -- src/components/convo-explorer/D3Map.smoke.test.tsx
```

**What it tests:**

- Component renders without crashing in both modes
- Mode switching doesn't cause errors
- Handles empty data gracefully
- Accepts all optional props

### Why Full Integration Tests Are Challenging

D3.js heavily relies on real DOM APIs and SVG properties that aren't fully available in JSDOM test environments. The component uses:

- SVG zoom transforms
- Complex D3 selections and data binding
- Real pointer/touch event handling
- Canvas-like coordinate transformations

## Manual Testing Protocol

### Critical Test Scenarios

Must Perform each in BOTH mobile and desktop mode.

#### 1. Basic Quick Select (Both Modes)

**Steps:**

1. Load the component in Storybook
2. Color some points
3. In move mode: Click on a painted point
4. Verify drawer opens to correct group
5. In paint mode: Click on a painted point
6. Verify drawer opens to correct group

**Expected:** Quick select works in both modes without errors

#### 2. Paint → Move → Quick Select → Paint (The Original Bug)

**Steps:**

1. Start in paint mode
2. Paint some points (drag to create lasso selection)
3. Switch to move mode
4. Click on a painted point (quick select)
5. Verify drawer opens
6. Switch back to paint mode
7. Try to paint again (drag to create lasso selection)
8. Try to paint one more time

**Expected:** Paint tool works normally after quick select
**Bug symptom:** Paint tool would malfunction, act like move mode

#### 3. Quick Select Unpainted → Paint (The Original Bug)

**Steps:**

1. Start in paint mode
2. Click on an UNpainted point (quick select)
3. Switch to move mode
4. Click on an UNpainted point (quick select)
5. Switch back to paint mode
6. Try to paint (drag to create lasso selection)

**Expected:** Paint tool works normally after quick select on unpainted group.

#### 3. Rapid Mode Switching

**Steps:**

1. Switch rapidly between paint and move modes
2. Perform quick selects in between switches
3. Try paint operations after each switch

**Expected:** No state corruption, all operations work normally

#### 4. Touch vs Mouse Events

**Steps:**

1. Test on desktop with mouse clicks
2. Test on mobile/tablet with touch taps
3. Test drag operations on both platforms

**Expected:** Consistent behavior across input methods

#### 5. Click vs Drag Detection

**Steps:**

1. Quick tap/click (< 10px movement, < 500ms duration)
2. Long press (> 500ms duration)
3. Drag operation (> 10px movement)

**Expected:**

- Quick tap triggers quick select
- Long press and drags don't trigger quick select

### Browser Testing

Test in multiple browsers to ensure cross-platform compatibility:

- Chrome (desktop & mobile)
- Firefox (desktop & mobile)
- Safari (desktop & mobile)
- Edge (desktop)

### Performance Testing

Monitor for memory leaks during mode switching:

1. Open browser dev tools
2. Switch modes repeatedly (50+ times)
3. Perform quick selects and paint operations
4. Check memory usage doesn't continuously grow

## Key Implementation Details to Monitor

### Event Handling Architecture

The current implementation uses a simple, unified approach:

```typescript
// Single pointer event handler for all platforms
const handlePointerDown = (event: PointerEvent) => {
  startPos = [event.clientX, event.clientY];
  startTime = Date.now();
};

const handlePointerUp = (event: PointerEvent) => {
  const distance = Math.sqrt(dx * dx + dy * dy);
  const duration = Date.now() - startTime;
  const isClick = distance < 10 && duration < 500;
  // Handle click/tap logic
};
```

### What to Watch For

1. **Event Listener Cleanup**: Ensure event listeners are properly removed when component unmounts or mode changes
2. **State Isolation**: Quick select and lasso drag should not share state
3. **Coordinate Transformations**: Ensure click detection works correctly with zoom/pan transforms
4. **Memory Leaks**: D3 selections and event listeners should be cleaned up

### Debugging Tips

1. **Enable Console Logging**: The component includes debug logs for event handling
2. **Check Event Propagation**: Ensure events are properly prevented when needed
3. **Monitor D3 State**: Use browser dev tools to inspect D3 selections and transforms

## Regression Prevention

### Code Review Checklist

When modifying D3Map component:

- [ ] Does the change affect event handling?
- [ ] Are event listeners properly cleaned up?
- [ ] Does mode switching still work correctly?
- [ ] Are there any new coordination mechanisms between systems?
- [ ] Has the simple pointer event architecture been maintained?

### Deployment Testing

Before deploying changes:

1. Run smoke tests: `npm run test:run -- D3Map.smoke.test.tsx`
2. Manual test the critical scenarios above
3. Test on multiple devices/browsers
4. Verify no console errors during normal usage

## Future Improvements

### Potential Test Enhancements

1. **E2E Tests**: Use Playwright to test real browser interactions
2. **Visual Regression Tests**: Screenshot comparisons for UI consistency
3. **Performance Tests**: Automated memory leak detection
4. **Accessibility Tests**: Ensure keyboard navigation works

### Code Improvements

1. **Extract Event Logic**: Move pointer event handling to custom hook
2. **Type Safety**: Add more specific TypeScript types for D3 interactions
3. **Error Boundaries**: Add error handling for D3 failures
4. **Performance**: Optimize re-renders and D3 updates

## Conclusion

The simplified pointer event architecture has resolved the original bug by eliminating complex coordination between systems. The key to preventing regression is maintaining this simplicity and thoroughly testing the critical interaction patterns manually.

Focus testing efforts on the mode switching scenarios, as these were the primary source of the original bug.
