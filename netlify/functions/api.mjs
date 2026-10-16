import { handleApi } from '../../api.mjs';

export default request => handleApi(request, { allowDemo: false });
export const config = { path: '/api/*' };
