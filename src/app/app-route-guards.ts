import {inject} from '@angular/core';
import {Router, UrlTree} from '@angular/router';

/**
 * Checks whether WebGPU API is supported and an adapter can be requested.
 *
 * @async
 * @returns {Promise<boolean>} whether WebGPU API is supported.
 */
async function hasWebGpu(): Promise<boolean> {
  let supported = false;
  try {
    supported = !!await navigator?.gpu?.requestAdapter?.();
  } catch (e) {
    console.warn('WebGPU check failed:', e);
  }
  return supported;
}

/**
 * Resolves a route guard for WebGPU availability policy.
 *
 * @param {boolean} requireWebGpu whether the route requires WebGPU support.
 * @param {string} redirectPath redirect path when the policy is not met.
 * @returns {Promise<boolean | UrlTree>} whether the route can activate.
 */
async function resolveWebGpuGuard(requireWebGpu: boolean, redirectPath: string): Promise<boolean | UrlTree> {
  const router = inject(Router);
  const supported = await hasWebGpu();
  let result: boolean | UrlTree;
  if (supported === requireWebGpu) {
    result = true;
  } else {
    result = router.createUrlTree([redirectPath]);
  }
  return result;
}

/**
 * Guard for routes that require WebGPU.
 *
 * @returns {Promise<boolean | UrlTree>} whether the route can activate.
 */
export async function webGpuGuard(): Promise<boolean | UrlTree> {
  return resolveWebGpuGuard(true, '/unsupported');
}

/**
 * Guard for the unsupported route, which should only be accessible without WebGPU.
 *
 * @returns {Promise<boolean | UrlTree>} whether the route can activate.
 */
export async function unsupportedGuard(): Promise<boolean | UrlTree> {
  return resolveWebGpuGuard(false, '/404');
}
