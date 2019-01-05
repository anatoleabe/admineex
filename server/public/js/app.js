var app = angular.module('app', [
    'ngMaterial',
    'ui.router',
    'routes',
    'oc.lazyLoad',
    'angular-jwt',
    'TokenInterceptorService',
    'datetimeFilters',
    'mappingFilters',
    'limitFilters',
    'gettext',
    'ngSanitize',
    'chart.js'
]).config(function($mdThemingProvider) {
    $mdThemingProvider.definePalette('savics', {
        '50': 'ffffff',
        '100': 'F3DACD',
        '200': 'E8B9A0',
        '300': 'DB8E66',
        '400': 'D57B4E',
        '500': 'CF6935',
        '600': 'B95C2C',
        '700': 'cd6531',
        '800': '884320',
        '900': '6F371A',
        'A100': 'FFFFFF',
        'A200': 'F3DACD',
        'A400': 'D57B4E',
        'A700': 'A15026',
        'contrastDefaultColor': 'light', 
        'contrastDarkColors': ['50', '100','200', '300', '400', 'A100'],
        'contrastLightColors': undefined
    });
    $mdThemingProvider.theme('default').primaryPalette('blue-grey',{
        'default': '900'
    }).accentPalette('savics', {
        'default': '700',
        'hue-1': '500'
    });
}).config(function($mdDateLocaleProvider) {
    $mdDateLocaleProvider.formatDate = function(date) {
        var toReturn = "";
        if(date instanceof Date && !isNaN(date.valueOf())){
            var d = date.getDate();
            var m = date.getMonth() + 1;
            var y = date.getFullYear();
            toReturn = '' + (d <= 9 ? '0' + d : d) + '/' + (m<=9 ? '0' + m : m) + '/' + y;
        }
        return toReturn;
    }
});

// Dialog params
app.value('params', {});