angular.module('Procras7Directive', []).directive('procras7', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras7.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');
                $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                    var Card = $injector.get('Chart');

                    var CARD_NAME = "procras6_7";
                  
                    $scope.series = [ gettextCatalog.getString('Nb of tasks completed'), gettextCatalog.getString('Nb of tasks')];
                    $scope.colors = [{
                            backgroundColor: 'rgba(0, 128, 1, 0.6)',
                            pointBackgroundColor: 'rgba(0, 128, 1, 0.6)',
                            pointHoverBackgroundColor: 'rgba(0, 128, 1, 0.6)',
                            borderColor: 'rgba(0, 128, 1, 0.6)',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: 'rgba(0, 128, 1, 0.6)',
                        },{
                            backgroundColor: 'rgba(128, 128, 128, 0.6)',
                            pointBackgroundColor: 'rgba(128, 128, 128, 0.6)',
                            pointHoverBackgroundColor: 'rgba(128, 128, 128, 0.6)',
                            borderColor: 'rgba(128, 128, 128, 0.6)',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: 'rgba(128, 128, 128, 0.6)'
                        }]
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
                                        labelString: gettextCatalog.getString('Nb of tasks completed')
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
                            globalView: $rootScope.globalView
                        };
                        Card.build(params).then(function (response) {
                            var data = response.data;
                            $scope.data = {
                                absolute: [[], []]
                            }
                            for (i = 0; i < data.labels.length; i++) {
                                data.labels[i] = gettextCatalog.getString(data.labels[i]);
                                data.labels[i] = data.labels[i].substr(0, 3) + ".";
                            }
                            $scope.labels = data.labels;
                            for (var j = 0; j < data.data[0].length; j++) {
                                var total = data.data[0][j] + data.data[1][j] + data.data[2][j];
                                var p3 = data.data[2][j];
                                $scope.data.absolute[1].push(total);
                                $scope.data.absolute[0].push(p3);
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
                    
                    var watch = {};
                    watch.range = $rootScope.$watch('range', function (newValue, oldValue) {
                        if (newValue.from.value.getTime() !== oldValue.from.value.getTime() || newValue.to.value.getTime() !== oldValue.to.value.getTime()) {
                            $scope.loadingChart = true;
                            build();
                        }
                    }, true);
                    watch.selectedUser = $rootScope.$watch('globalView.selectedUser', function (newValue, oldValue) {
                        if (newValue !== oldValue) {
                            console.log(newValue)
                            $scope.loadingChart = true;
                            build();
                        }
                    }, true);
                    $scope.$on('$destroy', function () {// in case of directive destroy, we destroy the watch
                        watch.range();
                        watch.selectedUser();
                    });
                });
            });
        }
    };
});
