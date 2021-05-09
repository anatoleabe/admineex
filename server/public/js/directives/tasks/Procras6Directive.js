angular.module('Procras6Directive', []).directive('procras6', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras6.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');
                $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                    var Card = $injector.get('Chart');
                    var CARD_NAME = "procras6";
                    $scope.absoluteMode = true;
                    $scope.toggleaAsoluteMode = function () {
                        if ($scope.absoluteMode === true) {
                            $scope.options.scales.yAxes[0].scaleLabel.labelString = gettextCatalog.getString('Percent');
                            $scope.options.tooltips = {
                                callbacks: {
                                    label: function (tooltipItem, data) {
                                        return data.datasets[tooltipItem.datasetIndex].label + gettextCatalog.getString(':') + ' ' + data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index] + '%';
                                    }
                                }
                            };
                            $scope.options.scales.yAxes[0].ticks = {
                                max: 100,
                                min: 0
                            };
                        } else {
                            $scope.options.scales.yAxes[0].scaleLabel.labelString = gettextCatalog.getString('Nb of tasks');
                            delete $scope.options.tooltips;
                            delete $scope.options.scales.yAxes[0].ticks;
                        }
                        $scope.absoluteMode = !$scope.absoluteMode;
                    }

                    $scope.series = [gettextCatalog.getString('Not stared'), gettextCatalog.getString('In progress'), gettextCatalog.getString('Completed')];
                    $scope.colors = [{
                            backgroundColor: 'rgba(128, 128, 128, 0.6)',
                            pointBackgroundColor: 'rgba(128, 128, 128, 0.6)',
                            pointHoverBackgroundColor: 'rgba(128, 128, 128, 0.6)',
                            borderColor: 'rgba(128, 128, 128, 0.6)',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: 'rgba(128, 128, 128, 0.6)'
                        }, {
                            backgroundColor: 'rgba(255, 140, 2, 0.6)',
                            pointBackgroundColor: 'rgba(255, 140, 2, 0.6)',
                            pointHoverBackgroundColor: 'rgba(255, 140, 2, 0.6)',
                            borderColor: 'rgba(255, 140, 2, 0.6)',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: 'rgba(255, 140, 2, 0.6)'
                        }, {
                            backgroundColor: 'rgba(0, 128, 1, 1)',
                            pointBackgroundColor: 'rgba(0, 128, 1, 1)',
                            pointHoverBackgroundColor: 'rgba(0, 128, 1, 1)',
                            borderColor: 'rgba(0, 128, 1, 1)',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: 'rgba(0, 128, 1, 1)',
                        }];
                    $scope.options = {
                        legend: {
                            display: true,
                            position: 'bottom'
                        },
                        scales: {
                            xAxes: [{
                                    stacked: true,
                                    gridLines: {
                                        display: false
                                    }
                                }],
                            yAxes: [{
                                    stacked: true,
                                    scaleLabel: {
                                        display: true,
                                        labelString: gettextCatalog.getString('Nb of tasks')
                                    },
                                    gridLines: {
                                        display: false
                                    }
                                }]
                        }
                    };
                    function build() {
                        var params = {
                            name: CARD_NAME,
                            from: $rootScope.range.from.value,
                            to: $rootScope.range.to.value,
                            globalView: $rootScope.globalView,
                        };
                        Card.build(params).then(function (response) {
                            var data = response.data;
                            $scope.data = {
                                absolute: data.data,
                                percentage: [[], [], []]
                            }
                            for (i = 0; i < data.labels.length; i++) {
                                data.labels[i] = gettextCatalog.getString(data.labels[i]);
                                data.labels[i] = data.labels[i].substr(0, 3) + ".";
                            }
                            $scope.labels = data.labels;
                            for (var j = 0; j < data.data[0].length; j++) {
                                var total = data.data[0][j] + data.data[1][j] + data.data[2][j];
                                var p1 = isNaN(round(((data.data[0][j] / (total)) * 100), 1)) ? 0 : round(((data.data[0][j] / (total)) * 100), 1);
                                var p2 = isNaN(round(((data.data[1][j] / (total)) * 100), 1)) ? 0 : round(((data.data[1][j] / (total)) * 100), 1);
                                var p3 = isNaN(round(((data.data[2][j] / (total)) * 100), 1)) ? 0 : round(((data.data[2][j] / (total)) * 100), 1);
                                $scope.data.percentage[0].push(p1);
                                $scope.data.percentage[1].push(p2);
                                $scope.data.percentage[2].push(p3);
                            }
                            $scope.loadingChart = false;
                        }).catch(function (response) {
                            if (response.xhrStatus !== "abort") {
                                console.error(response);
                                $rootScope.kernel.alerts.push({
                                    type: 1,
                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                    priority: 2
                                });
                            }
                            $scope.loadingChart = false;
                        });
                    }
                    $scope.loadingChart = true;
                    build();
                });
            });
            function round(value, precision) {
                var multiplier = Math.pow(10, precision || 0);
                return Math.round(value * multiplier) / multiplier;
            }
        }

    };
});
