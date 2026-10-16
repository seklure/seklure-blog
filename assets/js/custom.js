/**
 * seklureBlog 站点自定义脚本。
 *
 * 说明：
 *   主题（FixIt）在初始化时会向浏览器控制台输出一条带主题名的推广横幅。
 *   本站已按需求将页面上所有 Hugo / FixIt 标识替换为 seklure，
 *   因此这里用一个窄匹配的过滤器屏蔽该横幅（只过滤同时包含两个特征词的输出，
 *   不影响其它日志）。如不需要，删除下方 IIFE 即可。
 */
class SeklureBlog {
  /**
   * 站点就绪提示
   * @returns {SeklureBlog}
   */
  hello() {
    console.log('custom.js: seklureBlog ready.');
    return this;
  }

  /**
   * 初始化
   * @returns {SeklureBlog}
   */
  init() {
    this.hello();
    return this;
  }
}

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
 * 立即执行
 */
(() => {
  window.seklureBlog = new SeklureBlog();
  // DOM 树构建完成后执行
  document.addEventListener('DOMContentLoaded', () => {
    window.seklureBlog.init();
  });
})();
