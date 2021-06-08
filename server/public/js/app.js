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
    'chart.js',
    'ngSanitize',
    'PendingRequestService',
    'CancellableHTTPService'
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
}).config(['ChartJsProvider', function(ChartJsProvider) {
    // Doughnut: label at center
    Chart.pluginService.register({
        beforeDraw: function(chart) {
            var width = chart.chart.width,
                height = chart.chart.height,
                ctx = chart.chart.ctx,
                type = chart.config.type,
                heightLegend = chart.legend.height;

            if (type == 'doughnut'){
                // Values
                var value1 = {
                    text: chart.config.data.datasets[0].data[1]+"",
                    color: chart.config.data.datasets[0].backgroundColor[1]
                }
                var value2 = {
                    text: "/",
                    color: "#6c6c6c"
                }
                var value3 = {
                    text: chart.config.data.datasets[0].data[0]+"",
                    color: chart.config.data.datasets[0].backgroundColor[0]
                }


                // Style
                var oldFill = ctx.fillStyle;
                var fontSize = ((height - chart.chartArea.top) / 100).toFixed(2);
                fontSize = fontSize - ((value1.text.length + value2.text.length + value3.text.length)/8);
                ctx.restore();
                ctx.font = fontSize + "em sans-serif";
                ctx.textBaseline = "middle"

                // Texts coord.
                var textW1 = ctx.measureText(value1.text).width,
                    textW2 = ctx.measureText(value2.text).width,
                    textW3 = ctx.measureText(value3.text).width;

                var textX1 = Math.round((width - textW1 - textW2 - textW3) / 2),
                    textX2 = textX1 + textW1,
                    textX3 = textX2 + textW2,
                    textY = (height + chart.chartArea.top - heightLegend) / 2;

                // Style
                ctx.fillStyle = value3.color;
                ctx.fillText(value3.text, textX3, textY);
                ctx.fillStyle = value2.color;
                ctx.fillText(value2.text, textX2, textY);
                ctx.fillStyle = value1.color;
                ctx.fillText(value1.text, textX1, textY);
                ctx.fillStyle = oldFill;
                ctx.save();
            } else if(type == "pie"){
                var empty = true;
                for(var i=0;i<chart.data.datasets[0].data.length;i++){
                    if(chart.data.datasets[0].data[i] !== 0){
                        empty = false;
                    }
                }
                if(empty){
                    chart.clear();
                    ctx.restore();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = "32px normal";
                    ctx.fillText('Ø', width / 2, (height -32/2) / 2);
                    ctx.fillStyle = "#d3d3d3";
                    ctx.save();
                } else {
                    chart.clear();
                }
            }
        }
    });
}]);

// Dialog params
app.value('params', {});