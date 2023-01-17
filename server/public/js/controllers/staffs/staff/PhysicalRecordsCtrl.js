angular.module('PhysicalRecordsCtrl', []).controller('PhysicalRecordsController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;
    $scope.sanctions = []

    var helper = {
        title: gettextCatalog.getString("No saction found"),
        icon: "gavel"
    };

    $scope.filters = {
        status: "-"
    };

    $scope.filters = {
        category: "-1",
        owner: "-",
        ownerType: "-",
    };
    $scope.query = {
        limit: 25,
        page: 1,
        order: "-lastModified"
    };

    $scope.helper = {
        title: gettextCatalog.getString("No sanction found"),
    };

    $rootScope.showGlobalView = false;

    $rootScope.kernel.loading = 100;
    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };

    $ocLazyLoad.load('js/services/DocumentService.js').then(function () {
        var Document1 = $injector.get('Document');
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');
            Dictionary.jsonList({dictionary: 'document', levels: ['categories']}).then(function (response) {
                $scope.categories = response.data.jsonList;

                $scope.getDocuments = function () {

                    var deferred = $q.defer();

                    $rootScope.kernel.loading = 0;
                    $scope.helper = [];
                    var limit = $scope.query.limit;
                    var skip = $scope.query.limit * ($scope.query.page - 1);
                    var filterParams = {
                        category: $scope.filters.category,
                        owner: $scope.filters.owner,
                        ownerType: $scope.filters.ownerType,
                        from: $rootScope.range.from.value,
                        to: $rootScope.range.to.value
                    };
                    Document1.list({limit: limit, skip: skip, search: $scope.search, filters: JSON.stringify(filterParams)}).then(function (response) {
                        var data = response.data;
                        $rootScope.kernel.loading = 100;
                        $scope.documents = {
                            data: data,
                            count: data.length
                        };
                        return deferred.promise;
                    }).catch(function (response) {
                        console.log(response);
                    });
                }
                $scope.getDocuments();

                var watch = {};

                watch.category = $scope.$watch('filters.category', function (newval, oldval) {
                    if (newval && oldval && newval != oldval) {
                        $scope.getDocuments();
                    }
                });

                watch.ownerType = $scope.$watch('filters.ownerType', function (newval, oldval) {
                    if (newval && oldval && newval != oldval) {
                        $scope.getDocuments();
                    }
                });


                watch.search = $scope.$watch('search', function (newval, oldval) {
                    if (newval) {
                        $scope.getDocuments();
                    }
                });


                watch.range = $rootScope.$watch('range', function (newValue, oldValue) {
                    if (newValue.from.value.getTime() !== oldValue.from.value.getTime() || newValue.to.value.getTime() !== oldValue.to.value.getTime()) {
                        $scope.loadingChart = true;
                        $scope.getDocuments();
                    }
                }, true);


                $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                    watch.category();
                    watch.ownerType();
                    watch.search();
                    watch.range();
                });

                $scope.new = function () {
                    $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                        $mdDialog.show({
                            controller: 'PhysicalRecordController',
                            templateUrl: '../templates/dialogs/physicalRecord.html',
                            parent: angular.element(document.body),
                            clickOutsideToClose: true,
                            locals: {
                                params: {
                                }
                            }
                        }).then(function (answer) {
                            $scope.getDocuments();
                        }, function () {
                        });
                    });
                };




                $scope.edit = function (doc) {
                    $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                        $mdDialog.show({
                            controller: 'PhysicalRecordController',
                            templateUrl: '../templates/dialogs/physicalRecord.html',
                            parent: angular.element(document.body),
                            clickOutsideToClose: true,
                            locals: {
                                params: {
                                    doc: doc
                                }
                            }
                        }).then(function (answer) {
                            $scope.getDocuments();
                        }, function () {
                        });
                    });
                };

                $scope.showConfirm = function (document) {
                    var confirm = $mdDialog.confirm()
                            .title(gettextCatalog.getString("Delete this document"))
                            .textContent(gettextCatalog.getString("Are you sure you want to delete this document") + " " + document.fileName + gettextCatalog.getString("?"))
                            .ok(gettextCatalog.getString("Delete"))
                            .cancel(gettextCatalog.getString("Cancel"));

                    $mdDialog.show(confirm).then(function () {
                        // Delete
                        Document1.delete({
                            id: document._id
                        }).then(function (response) {
                            $scope.getDocuments();
                            $rootScope.kernel.alerts.push({
                                type: 3,
                                msg: gettextCatalog.getString('The document has been deleted successfully'),
                                priority: 4
                            });
                        }).catch(function (response) {
                            console.log(response);
                        });
                    }, function () {
                        // Cancel
                    });
                }


                $scope.download = function (document) {
                    $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                        var FileSaver = $injector.get('FileSaver');
                        $rootScope.kernel.loading = 0;
                        var deferred = $q.defer();
                        $scope.promise = deferred.promise;
                        function jsonBufferToObject(data, headersGetter, status) {
                            var type = headersGetter("Content-Type");
                            if (!type.startsWith("application/json")) {
                                return data;
                            }
                            ;
                            var decoder = new TextDecoder("utf-8");
                            var domString = decoder.decode(data);
                            var json = JSON.parse(domString);
                            return json;
                        }

                        $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                            var Download = $injector.get('Download');
                            Download.start({
                                method: 'GET',
                                url: '/api/documents/download/' + document._id,
                                headers: {'Content-Type': "blob"},
                                transformResponse: jsonBufferToObject
                            }).then(function (response) {
                                var d = new Blob([response.data]);
                                FileSaver.saveAs(d, document.fileName);
                                $rootScope.kernel.loading = 100;
                                deferred.resolve(response.data);
                            }).catch(function (response) {
                                console.error(response);
                                if (response.data && response.data.error === '9500') {
                                    $rootScope.kernel.alerts.push({
                                        type: 1,
                                        msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                        priority: 1
                                    });
                                    $rootScope.kernel.loading = 100;
                                }
                            });
                        });
                    });
                }


                $scope.view = function (document) {
                    $rootScope.kernel.loading = 0;
                    var deferred = $q.defer();
                    $scope.promise = deferred.promise;
                    function jsonBufferToObject(data, headersGetter, status) {
                        var type = headersGetter("Content-Type");
                        if (!type.startsWith("application/json")) {
                            return data;
                        }
                        ;
                        var decoder = new TextDecoder("utf-8");
                        var domString = decoder.decode(data);
                        var json = JSON.parse(domString);
                        return json;
                    }

                    $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                        var Download = $injector.get('Download');
                        Download.start({
                            method: 'GET',
                            url: '/api/documents/download/' + document._id,
                            headers: {'Content-Type': "blob"},
                            transformResponse: jsonBufferToObject
                        }).then(function (response) {
                            console.log("downloaded ====")
                            var d = new Blob([response.data]);
                            $scope.documentToView = d;
                            $rootScope.kernel.loading = 100;
                            deferred.resolve(response.data);
                        }).catch(function (response) {
                            console.error(response);
                        });
                    });
                }

                $scope.view = function (document) {
                    $rootScope.kernel.loading = 0;
                    var deferred = $q.defer();
                    $scope.promise = deferred.promise;
                    function jsonBufferToObject(data, headersGetter, status) {
                        var type = headersGetter("Content-Type");
                        if (!type.startsWith("application/json")) {
                            return data;
                        }
                        ;
                        var decoder = new TextDecoder("utf-8");
                        var domString = decoder.decode(data);
                        var json = JSON.parse(domString);
                        return json;
                    }
                    $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                        var Download = $injector.get('Download');
                        Download.start({
                            method: 'GET',
                            url: '/api/documents/download/' + document._id,
                            headers: {'Content-Type': "blob"},
                            transformResponse: jsonBufferToObject
                        }).then(function (response) {
                            //var d = new Blob([response.data]);
                            var documentToView = new Uint8Array(response.data);
                            $mdDialog.show({
                                controller: ['$scope', '$mdDialog', 'data', function ($scope, $mdDialog, data) {
                                        $scope.documentToView = data;
                                    }],
                                templateUrl: '../templates/dialogs/pdfViewer.html',
                                parent: angular.element(document.body),
                                clickOutsideToClose: true,
                                locals: {
                                    data: documentToView
                                }
                            }).then(function (answer) {
                                //$scope.getAffectations();
                            }, function () {
                            });
                            $rootScope.kernel.loading = 100;
                            deferred.resolve(response.data);
                        }).catch(function (response) {
                            console.error(response);
                        });
                    });
                }

                $scope.details = function (p) {
                    // Increase read 
                    $ocLazyLoad.load('js/services/DocumentService.js').then(function () {
                        var Document = $injector.get('Document');
                        Document.read({id: p._id}).then(function (response) {
                            //NO action needed
                        }).catch(function (response) {
                            console.log(response);
                        });
                    });
                    $mdDialog.show({
                        controller: ['$scope', '$mdDialog', 'p', function ($scope, $mdDialog, p, pdf, pdfjsViewer) {
                                $scope.doc = p;
                                $scope.close = function () {
                                    $mdDialog.hide();
                                }
                                $scope.cancel = function () {
                                    $mdDialog.cancel();
                                };

                                $scope.edit = function (doc) {
                                    $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                                        $mdDialog.show({
                                            controller: 'PhysicalRecordController',
                                            templateUrl: '../templates/dialogs/physicalRecord.html',
                                            parent: angular.element(document.body),
                                            clickOutsideToClose: true,
                                            locals: {
                                                params: {
                                                    doc: doc
                                                }
                                            }
                                        }).then(function (answer) {
                                            //$scope.getAffectations();
                                        }, function () {
                                        });
                                    });
                                };

                                $scope.showConfirm = function (document) {
                                    var confirm = $mdDialog.confirm()
                                            .title(gettextCatalog.getString("Delete this document"))
                                            .textContent(gettextCatalog.getString("Are you sure you want to delete this document") + " " + document.fileName + gettextCatalog.getString("?"))
                                            .ok(gettextCatalog.getString("Delete"))
                                            .cancel(gettextCatalog.getString("Cancel"));

                                    $mdDialog.show(confirm).then(function () {
                                        // Delete
                                        Document1.delete({
                                            id: document._id
                                        }).then(function (response) {
                                            $scope.getDocuments();
                                            $rootScope.kernel.alerts.push({
                                                type: 3,
                                                msg: gettextCatalog.getString('The document has been deleted successfully'),
                                                priority: 4
                                            });
                                        }).catch(function (response) {
                                            console.log(response);
                                        });
                                    }, function () {
                                        // Cancel
                                    });
                                }


                                $scope.download = function (document) {
                                    $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                        var FileSaver = $injector.get('FileSaver');
                                        $rootScope.kernel.loading = 0;
                                        var deferred = $q.defer();
                                        $scope.promise = deferred.promise;
                                        function jsonBufferToObject(data, headersGetter, status) {
                                            var type = headersGetter("Content-Type");
                                            if (!type.startsWith("application/json")) {
                                                return data;
                                            }
                                            ;
                                            var decoder = new TextDecoder("utf-8");
                                            var domString = decoder.decode(data);
                                            var json = JSON.parse(domString);
                                            return json;
                                        }

                                        $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                            var Download = $injector.get('Download');
                                            Download.start({
                                                method: 'GET',
                                                url: '/api/documents/download/' + document._id,
                                                headers: {'Content-Type': "blob"},
                                                transformResponse: jsonBufferToObject
                                            }).then(function (response) {
                                                console.log("response -----")
                                                console.log(response)
                                                var d = new Blob([response.data]);
                                                FileSaver.saveAs(d, document.fileName);
                                                $rootScope.kernel.loading = 100;
                                                deferred.resolve(response.data);
                                            }).catch(function (response) {
                                                console.error(response);
                                                if (response.data && response.data.error === '9500') {
                                                    $rootScope.kernel.alerts.push({
                                                        type: 1,
                                                        msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                                        priority: 1
                                                    });
                                                    $rootScope.kernel.loading = 100;
                                                }
                                            });
                                        });
                                    });
                                }

                                $scope.view = function (document) {
                                    $rootScope.kernel.loading = 0;
                                    var deferred = $q.defer();
                                    $scope.promise = deferred.promise;
                                    function jsonBufferToObject(data, headersGetter, status) {
                                        var type = headersGetter("Content-Type");
                                        if (!type.startsWith("application/json")) {
                                            return data;
                                        }
                                        ;
                                        var decoder = new TextDecoder("utf-8");
                                        var domString = decoder.decode(data);
                                        var json = JSON.parse(domString);
                                        return json;
                                    }
                                    $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                        var Download = $injector.get('Download');
                                        Download.start({
                                            method: 'GET',
                                            url: '/api/documents/download/' + document._id,
                                            headers: {'Content-Type': "blob"},
                                            transformResponse: jsonBufferToObject
                                        }).then(function (response) {
                                            //var d = new Blob([response.data]);
                                            var documentToView = new Uint8Array(response.data);
                                            $mdDialog.show({
                                                controller: ['$scope', '$mdDialog', 'data', function ($scope, $mdDialog, data) {
                                                        $scope.documentToView = data;
                                                    }],
                                                templateUrl: '../templates/dialogs/pdfViewer.html',
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    data: documentToView
                                                }
                                            }).then(function (answer) {
                                                //$scope.getAffectations();
                                            }, function () {
                                            });
                                            $rootScope.kernel.loading = 100;
                                            deferred.resolve(response.data);
                                        }).catch(function (response) {
                                            console.error(response);
                                        });
                                    });
                                }

                            }],
                        templateUrl: '../templates/dialogs/physicalRecordDetails.html',
                        parent: angular.element(document.body),
                        clickOutsideToClose: true,
                        locals: {
                            p: p
                        }
                    }).then(function (answer) {

                    }, function () {

                    });
                }

            });
        });
    });
});
