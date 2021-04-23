angular.module('TasksCtrl', ['dndLists']).controller('TasksController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/TaskService.js').then(function () {
        var Task = $injector.get('Task');


        $s = $scope;
        $scope.models = {
            selected: null,
            lists: {
                "A": [],
                "B": []
            },
            tasks: []
        };


        $scope.filters = {
            status: "-1",
            priority: "-1",
            category: "-1",
        };

        $scope.query = {
            limit: 25,
            page: 1,
            order: "create"
        };

        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');

            Dictionary.jsonList({dictionary: 'task', levels: ['statuses']}).then(function (response) {
                $scope.status = response.data.jsonList;
                Dictionary.jsonList({dictionary: 'task', levels: ['priorities']}).then(function (response) {
                    $scope.priorities = response.data.jsonList;
                    $ocLazyLoad.load('js/services/CategoryService.js').then(function () {
                        var Category = $injector.get('Category');
                        Category.list().then(function (response) {
                            var data = response.data;
                            $rootScope.kernel.loading = 100;
                            $scope.categories = data;
                        }).catch(function (response) {
                            console.error(response);
                        });

                        $scope.details = function (params) {
                            $state.go("home.tasks.details", params);
                        };

                        $scope.edit = function (params) {
                            $state.go("home.tasks.edit", params);
                        };

                        $scope.new = function () {
                            $state.go("home.tasks.new");
                        };

                        $rootScope.kernel.loading = 100;


                        function getMyTasks() {
                            $scope.helper = [];

                            Task.list($scope.filters).then(function (response) {
                                console.log(response)
                                var data = response.data;
                                if (data.length == 0 && $scope.helper.length == 0) {
                                    $scope.helper = "No task";
                                }
                                $rootScope.kernel.loading = 100;
                                $scope.tasks = data;
                            }).catch(function (response) {
                                console.error(response);
                            });
                        }
                        getMyTasks();

                        var watch = {};

                        watch.status = $scope.$watch('filters.status', function (newval, oldval) {
                            if (newval && oldval && newval != oldval) {
                                getMyTasks();
                            }
                        });
                        watch.priority = $scope.$watch('filters.priority', function (newval, oldval) {

                            if (newval && oldval && newval != oldval) {
                                getMyTasks();
                            }
                        });
                        watch.category = $scope.$watch('filters.category', function (newval, oldval) {
                            if (newval && oldval && newval != oldval) {
                                getMyTasks();
                            }
                        });

                        $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                            watch.category();
                            watch.priority();
                            watch.status();
                        });


                        // Generate initial model
                        for (var i = 1; i <= 3; ++i) {
                            $scope.models.lists.A.push({
                                label: "Item A" + i
                            });
                            $scope.models.lists.B.push({
                                label: "Item B" + i
                            });
                            $scope.models.tasks.push({
                                label: "Tache" + i
                            })
                        }

                        $scope.addToList = function (list) {
                            var
                                    i = {
                                        label: "Item " + (list.length + 1)
                                    };
                            list.push(i);

                        }

                        $scope.addToTasks = function (task) {
                            var
                                    i = {
                                        label: "Tache o " + (task.length + 1)
                                    };
                            task.push(i);

                        }

                        $scope.people = [
                            {name: 'Janet Perkins', img: 'img/100-0.jpeg', newMessage: true},
                            {name: 'Mary Johnson', img: 'img/100-1.jpeg', newMessage: false},
                            {name: 'Peter Carlsson', img: 'img/100-2.jpeg', newMessage: false}
                        ];


                        $scope.cloneItem = function (list, index) {
                            var
                                    //o = { label : list[index].label+"-1"};
                                    o = angular.copy(list[index]);

                            o.label = o.label + "-1";
                            list.splice(index + 1, 0, o);
                            //  $scope.$apply();
                        }
                        $scope.removeFromList = function (list, index) {
                            list.splice(index, 1);
                        }
                        $scope.removeFromTasks = function (task, index) {
                            task.splice(index, 1);
                        }

                        $scope.list = $scope.models.lists.A;
                        $scope.taches = $scope.models.tasks;

                        // Model to JSON for demo purpose
                        $scope.$watch('models', function (model) {
                            $scope.modelAsJson = angular.toJson(model, true);
                        }, true);

                        $s.models.selected = $s.models.lists["A"][1];


                        $scope.read = function (id) {
                            var p;
                            Task.read({
                                id: id
                            }).then(function (response) {
                                var data = response.data;
                                var p = data;
                                console.log(p)
                                $mdDialog.show({
                                    controller: ['$scope', '$mdDialog', 'p', function ($scope, $mdDialog, p) {
                                            $scope.task = p;
                                            $scope.close = function () {
                                                $mdDialog.hide();
                                            }
                                            $scope.cancel = function () {
                                                $mdDialog.cancel();
                                            };
                                            $scope.edit = function (params) {
                                                $mdDialog.hide();
                                                $rootScope.kernel.loading = 0;
                                                $state.go("home.tasks.edit", params);
                                            };

                                            $scope.showConfirm = function (task) {
                                                var confirm = $mdDialog.confirm()
                                                        .title(gettextCatalog.getString("Delete this task"))
                                                        .textContent(gettextCatalog.getString("Are you sure you want to delete the task") + " " + task.name.given + " " + task.name.family + gettextCatalog.getString("?"))
                                                        .ok(gettextCatalog.getString("Delete"))
                                                        .cancel(gettextCatalog.getString("Cancel"));

                                                $mdDialog.show(confirm).then(function () {
                                                    // Delete
                                                    deleteContact(task._id)
                                                }, function () {
                                                    // Cancel
                                                });
                                            }

                                        }],
                                    templateUrl: '../templates/procrastinate/tasks/dialogs/task.html',
                                    parent: angular.element(document.body),
                                    clickOutsideToClose: true,
                                    locals: {
                                        p: p
                                    }
                                }).then(function (answer) {

                                }, function () {

                                });
                            }).catch(function (response) {
                                console.error(response);
                            });
                        }
                    });
                });
            });
        });
    });
});
