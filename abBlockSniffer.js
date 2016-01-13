/**
 * @description: 探测页面节点的屏蔽情况，添加内联样式尝试恢复展现
 * @author: steinitz@qq.com
 * @date: 16-01-11 下午7:03
 *
 *  DEMO:
 *  强烈建议加上一个timer:
    ======= demo code======
    setTimeout(function(){
        // 实际使用的时候，el配置为广告区
        var area = [
            {
                name: 'body-area', 
                el: 'body' // 测试document.body（实际使用，建议设置为广告位区域）
            }
        ];
       
       
       adBlockSniffer(area, {
            complete: function(ret) {
                console.log(JSON.stringify(ret));
            }
       })
       
       
    }, 3000);

    ========result==========
    [{
        "name":"body",
        "el":"
              HTML>BODY>DIV#BAIDU_DUP_fp_wrapper>IFRAME#BAIDU_DUP_fp_iframe,
              HTML>BODY>DIV.wrapper>DIV.adv-banner
            ",
        "status":0,
        "reject":"none,none,none",
        "resolve":"1,1,1"
    }]
 */

// 引入 jQuery或zepto
// var $ = require(jQuery | zepto);

// 兼容zepto
var getStyle = function(el, name) {
    return el.currentStyle ? el.currentStyle[name] : document.defaultView.getComputedStyle(el, '').getPropertyValue(name);
};

// 得到当前节点的选择器
var getSelector = function(el) {
    var selector = el.tagName;

    if (el.id) {
        selector += '#' + el.id;
    }

    if (el.className) {
        selector += '.' + el.className.split(/\s+/g).join('.');
    }

    return selector;
};

var getSelectorAll = function(el) {
    var selectors = [];

    selectors.push(getSelector(el));

    $(el).parents().each(function(index, item) {
        selectors.push(getSelector(item));
    });

    return selectors.reverse().join('>');
};


/*
 * @description 找到页面中被浏览器隐藏节点（隐藏的可能是该节点或者子节点，需要遍历）
 **/

var AdBlockSniffer = function() {};

AdBlockSniffer.prototype = {
    /*
    *   @description: 主函数
    *   @param {array} checkList 数组项目是一个key/value的键值，方便统计
    *       demo: [
    *           {
                    name: 'top-banner',
                    // 当前广告位selector，可以用css3选择器来匹配
                    el: 'iframe[src^="http://some.ad.com"]'
                }, {
                    // 正常的标题，测试
                    name: 'title',
                    el: 'h1'
                }, {
                    // 右侧广告
                    name: 'banner-ad',
                    el: '.banner-ad'
                }
    *    ]
    *
    *   @return {array} 得到一个当前广告位状态信息
            [
                {
                    name: 'top-banner', // 来自参数中的name标识
                    el: 'selector',     // 来自参数中的el标识，或者是子节点selector
                    status: 0,          // 1(正常) | 0(不正常) 
                    reject: 'remove',    // remove: 被移除了，none: 被display隐藏了，hidden:被visibility属性hidden了
                    resolve: 1 | 0    // 1（恢复展现） | 0（未恢复展现）
                }
            ]

    */
    init: function(checkList, $whiteList) {
        this.log = [];
        var me = this;
        
        this.$whiteList = $whiteList;

        $.each(checkList, function(key, item) {
            // console.log(item);
            // 默认值为正常
            item.status = 1;
            me.speculate(item);
        });

        return this.log;
    },

    log: function() {
        // todo
    },

    speculate: function(item) {
        if (!$(item.el).length) {
            // 如果节点不存在，标记为remove
            this.log.push($.extend(item, {
                status: 0,
                reject: 'remove'
            }));
            return;
        }

        this.subLog = [];

        // 默认为不隐藏
        this.reject = [];

        // 恢复展现flag
        this.resolve = [];

        this.traverse(item.el);

        // 逗号分割
        // var reject = $.unique(this.reject).join();

        var o = $.extend({}, item);

        if (this.reject.length) {
            o.reject = this.reject.join();
            o.status = 0;
            o.el = this.subLog.join();
        }

        if (this.resolve.length) {
            o.resolve = this.resolve.join();
        }

        this.log.push($.extend(item, o));
    },

    traverse: function(el) {
        var me = this;

        $(el).each(function(index, item) {
            // item.tagName === 'H1' && console.log('checking:', me.check(item));
            me.check(item) || me.traverse($(item).children());
        });
    },


    baseCheck: function(el) {
        // 检查节点是否存在    
    },

    check: function(el) {
        // 忽略的tag
        if (/script|audio|head|meta|title|link|style|textarea/i.test(el.tagName)) {
            return !0;
        }

        // 忽略的节点，避免误报
        if (this.$whiteList && ~this.$whiteList.index(el)) {
            // console.log('whiteList:', el);
            return !0;
        }

        var originDisplay = $(el).css('display');
        var originVisibility = $(el).css('visibility');

        // 只寻找隐藏的点
        if (originDisplay !== "none" && originVisibility !== 'hidden') {
            return;
        }

        var originStyle = $(el).attr('style');

        originStyle = typeof originStyle === 'string' ? originStyle : false;

        var testStyle = 'display:block;visibility:visible';
        var resetAdStyle = 'display:block!important;visibility:visible!important';

        if (originStyle && !/;$/.test(originStyle)) {
            testStyle = ';' + testStyle;
            resetAdStyle = ';' + resetAdStyle;
        }

        $(el).attr('style', originStyle ? originStyle + testStyle : testStyle);

        // 恢复默认的样式
        if (getStyle(el, 'display') === 'block' && getStyle(el, 'visibility') === 'visible') {
            originStyle ? $(el).attr('style', originStyle) : $(el).removeAttr('style');
            return;
        }

        // getStyle(el, 'display') === 'block' || getStyle(el, 'visibility') === 'visible'
        getStyle(el, 'display') === 'none' && this.reject.push('none');
        getStyle(el, 'visibility') === 'hidden' && this.reject.push('hidden');

        // 针对被屏蔽的样式，恢复展现
        $(el).attr('style', originStyle ? originStyle + resetAdStyle : resetAdStyle);

        // 判断样式是否恢复展现
        this.resolve.push(+(getStyle(el, 'display') === 'block' && getStyle(el, 'visibility') === 'visible'));

        // 获取当前节点选择器
        return this.subLog.push(getSelectorAll(el));
    }
};

 /**
    * @description: 主函数
    * @param {array} checkList 数组项目是一个key/value的键值，方便统计
    *    demo: [
    *       {
    *          name: 'top-banner',
    *          // 当前广告位selector，可以用css3选择器来匹配
    *          el: 'iframe[src^="http://some.ad.com"]'
    *       }, {
    *          // 正常的标题，测试
    *          name: 'title',
    *          el: 'h1'
    *       }, {
    *          // 右侧广告
    *          name: 'banner-ad',
    *          el: '.banner-ad'
    *       }
    *    ]
    *
    * @param {object} option
    *     option.callback  {function}  回调函数 
    *     option.whiteList {array}     忽略的节点
    *
    * @return {array} 得到一个当前区域dom状态信息
    *    [
    *        {
    *            name: position,                  // 来自参数中的name标识
    *            el: selector,                    // 来自参数中的el标识，或者是子节点selector
    *            status: 0 | 1,                   // 1:正常 | 0:不正常 
    *            reject: remove | none | hidden,  // remove: 被移除了，none: 被display隐藏了，hidden:被visibility属性hidden了
    *            resolve: 0 | 1                   // 1:恢复展现了 | 0:未恢复展现
    *        }
    *    ]
    *
 **/
var adBlockSniffer = function(checkList, option) {
    option = option || {};
    var abs = new AdBlockSniffer();
    var $whiteList = option.whiteList && $(option.whiteList.join());
    $whiteList = $whiteList.length ? $whiteList : false;
    var ret = abs.init(checkList, $whiteList);
    option.callback && option.callback(ret);
    return ret;
};

module.exports = adBlockSniffer;