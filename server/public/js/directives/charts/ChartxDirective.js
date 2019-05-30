angular.module('ChartxDirective', []).directive('chartx', ['gettextCatalog', '$ocLazyLoad', '$injector', '$rootScope', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
        return {
            restrict: 'A',
            scope: {},
            templateUrl: 'templates/staffs/directives/chartx.html',
            link: function ($scope, $element, $attrs) {

                $ocLazyLoad.load('node_modules/progressbar.js/dist/progressbar.min.js').then(function () {
                    $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                        var bar = new ProgressBar.SemiCircle("containerx", {
                            strokeWidth: 6,
                            color: '#FFEA82',
                            trailColor: '#eee',
                            trailWidth: 1,
                            easing: 'easeInOut',
                            duration: 1400,
                            svgStyle: null,
                            text: {
                                value: '',
                                alignToBottom: false
                            },
                            from: {color: '#FFEA82'},
                            to: {color: '#ED6A5A'},
                            // Set default step function for all animate calls
                            step: (state, bar) => {
                                bar.path.setAttribute('stroke', state.color);
                                var value = Math.round(bar.value() * 70);
                                if (value === 0) {
                                    bar.setText('');
                                } else {
                                    bar.setText(value);
                                }

                                bar.text.style.color = state.color;
                            }
                        });
                        bar.text.style.fontFamily = '"Raleway", Helvetica, sans-serif';
                        bar.text.style.fontSize = '2rem';

                        bar.animate(0.7);  // Number from 0.0 to 1.0

                    }).catch(function (response) {
                        console.log(response);
                    });
                });
            }
        }

    }]);