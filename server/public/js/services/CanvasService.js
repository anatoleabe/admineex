angular.module('CanvasService', []).service('Canvas', function ($ocLazyLoad) {
    return {
        getCanvas: function (element, callback) {
            $ocLazyLoad.load("node_modules/html2canvas/dist/html2canvas.min.js").then(function () {
                html2canvas(document.getElementById(element)).then(function (canvas) {
                    return callback(canvas)
                });
            });
        }
    }
})
