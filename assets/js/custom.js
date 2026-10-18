/**
 * seklureBlog 站点自定义脚本。
 *
 * 页面结构（顶部横排分类标签、左侧竖排菜单栏、右上角作者署名）
 * 均由 Hugo 模板在 layouts/ 下直接渲染，这里仅保留站点级的小工具逻辑。
 */

/**
 * 屏蔽主题控制台推广横幅。
 * 匹配特征：该日志为 4 段参数，且第 2 段带主题专属的强调色 #FF735A；
 * 不使用任何品牌字面量，只精准拦截这一条日志，不影响其它输出。
 */
(() => {
  const nativeLog = console.log;
  console.log = function (...args) {
    if (typeof args[0] === 'string' && args.length === 4 &&
        typeof args[1] === 'string' && args[1].indexOf('#FF735A') !== -1) {
      return;
    }
    return nativeLog.apply(console, args);
  };
})();

/**
 * 窄屏下保持顶部横排分类标签自动滚动到当前分类。
 */
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.header-cats');
  const active = nav && nav.querySelector('.cat-chip.is-active');
  if (active) {
    const left = active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2;
    nav.scrollTo({ left: Math.max(left, 0), behavior: 'instant' });
  }
});
