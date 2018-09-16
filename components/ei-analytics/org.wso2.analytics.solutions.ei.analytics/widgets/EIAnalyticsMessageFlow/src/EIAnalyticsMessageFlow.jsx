/*
 * Copyright (c) 2018, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React from 'react';
import Widget from '@wso2-dashboards/widget';
import $ from 'jquery';
import dagreD3 from 'dagre-d3';
import * as d3 from 'd3';
import moment from 'moment';
import {Scrollbars} from 'react-custom-scrollbars';
import nanoScrollerSelector from 'nanoscroller';
import './custom.css';

const TYPE_MEDIATOR = 'mediator';
const TYPE_SEQUENCE = 'sequence';
const TYPE_ENDPOINT = 'endpoint';
const TYPE_PROXY = "proxy";
const TYPE_API = "api";
const TYPE_INBOUND_ENDPOINT = "inbound";
const TYPE_MESSAGE = "message";
const DEFAULT_META_TENANT_ID = '-1234';
const BASE_URL = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
const MEDIATOR_PAGE_URL = BASE_URL + TYPE_MEDIATOR;
const SEQUENCE_PAGE_URL = BASE_URL + TYPE_SEQUENCE;
const ENDPOINT_PAGE_URL = BASE_URL + TYPE_ENDPOINT;
const centerDiv = {
    textAlign: 'center',
    verticalAlign: 'middle'
};
const svgCenter = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

/**
 * Dashboard widget class for the EIAnalyticsMessageFlow widget
 */
class EIAnalyticsMessageFlow extends Widget {
    constructor(props) {
        super(props);
        this.parameters = {
            timeFrom: null,
            timeTo: null,
            timeUnit: null,
            selectedComponantID: null,
            meta_tenantId: '-1234',
            lastDrawnGraphData: null,
            isConfLoadError: false,
        };
        this.handleRecievedMessage = this.handleMessage.bind(this);
        this.handleAggregateData = this.handleAggregateData.bind(this);
        this.state = {
            dataUnavailable: true,
            height: this.props.glContainer.height,
            width: this.props.glContainer.width
        };
        this.props.glContainer.on('resize', () => {
            this.setState({
                width: this.props.glContainer.width,
                height: this.props.glContainer.height
            }, () => {
                this.drawMessageFlow($, this.parameters.lastDrawnGraphData)
            });
        });
        this.handleOnClick = (e) => {
            e.stopPropagation();
            $(".nodeLabel").removeClass('selected');
            $(this).addClass('selected');
            e.preventDefault();
            if (e.currentTarget.getAttribute("data-node-type") === "UNKNOWN") {
                return;
            }
            if (this.getCurrentPage() !== "message") {
                window.open(e.currentTarget.getAttribute("data-target-url"));
            } else {
                super.publish({
                    componentId: e.currentTarget.getAttribute("data-component-id")
                });
            }
        };
    }

    /**
     * Given data array for a message flow, draw message flow in the svg component
     *
     * @param $ Jquery selector
     * @param data Data array for the message flow
     */
    drawMessageFlow($, data) {
        this.parameters.lastDrawnGraphData = data;
        let hiddenLineStyle;
        if (this.detectIE() !== false) {
            hiddenLineStyle = 'display: none;';
        }
        else {
            hiddenLineStyle = 'stroke-width: 0px;';
        }
        if (data.length === 0) {
            $(this.domElementCanvas).html(this.renderEmptyRecordsMessage());
            return;
        }
        let groups = [];
        $(this.domElementCanvas).empty();
        let nodes = data;

        // Create the input graph
        let g = new dagreD3.graphlib.Graph({compound: true})
            .setGraph({rankdir: "LR"})
            .setDefaultEdgeLabel(function () {
                return {};
            });

        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id != null) {
                //Set Nodes
                if (nodes[i].type === "group") {
                    g.setNode(nodes[i].id, {label: "", clusterLabelPos: 'top'});

                    //Add arbitary nodes for group
                    g.setNode(nodes[i].id + "-s", {label: nodes[i].label, style: hiddenLineStyle});
                    // g.setEdge(nodes[i].id + "-s", nodes[i].id + "-e",  { style: 'display: none;; fill: #ffd47f'});
                    g.setNode(nodes[i].id + "-e", {label: "", style: hiddenLineStyle});
                    g.setParent(nodes[i].id + "-s", nodes[i].id);
                    g.setParent(nodes[i].id + "-e", nodes[i].id);

                    groups.push(nodes[i]);
                } else {
                    var label = this.buildLabel(nodes[i], $);
                    g.setNode(nodes[i].id, {labelType: "html", label: label});
                    // g.setNode(nodes[i].id, {label: nodes[i].label});
                }

                //Set Edges
                if (nodes[i].parents != null) {
                    for (var x = 0; x < nodes[i].parents.length; x++) {
                        var isParentGroup = false;
                        for (var y = 0; y < groups.length; y++) {
                            if (groups[y].id === nodes[i].parents[x] && groups[y].type === "group") {
                                isParentGroup = true;
                            }
                        }

                        if (nodes[i].type === "group") {
                            if (isParentGroup) {
                                g.setEdge(nodes[i].parents[x] + "-e", nodes[i].id + "-s", {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            } else {
                                g.setEdge(nodes[i].parents[x], nodes[i].id + "-s", {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            }
                        } else {
                            if (isParentGroup) {
                                g.setEdge(nodes[i].parents[x] + "-e", nodes[i].id, {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            } else {
                                g.setEdge(nodes[i].parents[x], nodes[i].id, {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            }
                        }
                    }
                }

                if (nodes[i].group != null) {
                    g.setParent(nodes[i].id, nodes[i].group);
                    if (nodes[i].type !== "group" && !this.isParent(nodes, nodes[i])) {
                        g.setEdge(nodes[i].group + "-s", nodes[i].id, {style: hiddenLineStyle});
                        g.setEdge(nodes[i].id, nodes[i].group + "-e", {style: hiddenLineStyle});
                    }


                }

            }

        }

        g.nodes().forEach(function (v) {
            let node = g.node(v);

            node.rx = node.ry = 7;
        });

        // Create the renderer
        let render = new dagreD3.render();

        $(this.domElementSvg).empty();

        let svg = d3.select(this.domElementSvg);
        svg.append("g");
        let inner = svg.select("g"),
            zoom = d3.zoom().on("zoom", function () {
                svg.select('g').attr("transform", d3.event.transform)
            });

        svg.call(zoom);
        let nanoScrollerSelector = $(this.domElementNano);
        nanoScrollerSelector.nanoScroller();
        inner.call(render, g);

        // Zoom and scale to fit
        let graphWidth = g.graph().width + 10;
        let graphHeight = g.graph().height + 10;
        let width = this.state.width;
        let height = this.state.height;
        if (graphWidth === 0 || graphHeight === 0) {
            console.error("Invalid graph dimension. Width or height is zero.");
            return;
        }
        let zoomScale = Math.min(width / graphWidth, height / graphHeight);
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity
                .scale(zoomScale)
                .translate(
                    (this.state.width - g.graph().width * zoomScale) / 2,
                    (this.state.height - g.graph().height * zoomScale) / 2)
        );
        svg.attr('width', width);
        svg.attr('height', height);

        d3.selectAll(this.domElementBtnZoomIn).on('click', function () {
            zoomScale += 0.05;
            this.interpolateZoom(translate, zoomScale, inner, zoom);
        });

        d3.selectAll(this.domElementBtnZoomOut).on('click', function () {
            if (zoomScale > 0.05) {
                zoomScale -= 0.05;
                this.interpolateZoom(translate, zoomScale, inner, zoom);
            }

        });

        d3.selectAll(this.domElementBtnZoomFit).on('click', function () {
            let zoomScale = Math.min(width / graphWidth, height / graphHeight);
            let translate = [(width / 2) - ((graphWidth * zoomScale) / 2), (height / 2) - ((graphHeight * zoomScale) / 2) * 0.93];
            zoom.translate(translate);
            zoom.scale(zoomScale);
            zoom.event(svg);
        });

        $("body").on("click", ".nodeLabel", this.handleOnClick);
    }

    /**
     * Extract most recent entry point message flow data array for a given component from the database for
     * proxy, api and inbound endpoint message flows
     *
     * @param timeFrom Time duration start positions
     * @param timeTo Time duration end position
     * @param timeUnit Per which time unit, data should be retrieved(minutes, seconds etc)
     * @param entryName Name of the component
     * @param tenantId Id value for the tenant
     */
    drawEntryPointMessageFlowGraph(timeFrom, timeTo, timeUnit, entryName, tenantId) {

        // Extract latest configEntry data row from the data store
        this.setState({
            dataUnavailable: true
        });
        const callBackFunction = this.handleConfigEntryData(timeUnit, timeFrom, timeTo, tenantId, entryName).bind(this);
        this.parameters.isConfLoadError = false;
        super.getWidgetConfiguration(this.props.widgetID)
            .then((message) => {
                let dataProviderConf = message.data;
                let query = dataProviderConf.configs.providerConfig.configs.config.queryData
                    .GET_CONFIG_ENTRY_DATA;
                let formattedQuery = query
                    .replace("{{entryName}}", entryName)
                    .replace("{{meta_tenantId}}", tenantId)
                    .replace("{{timeFrom}}", timeFrom)
                    .replace("{{timeTo}}", timeTo);
                dataProviderConf.configs.providerConfig.configs.config.queryData = {query: formattedQuery};
                super.getWidgetChannelManager().subscribeWidget(
                    this.props.id,
                    callBackFunction,
                    dataProviderConf.configs.providerConfig
                );
            })
            .catch(() => {
                this.parameters.isConfLoadError = true;
            });
    }

    handleConfigEntryData(timeUnit, timeFrom, timeTo, tenantId, entryName) {
        return (configEntryData) => {
            if (configEntryData != null && configEntryData.data.length !== 0) {
                let hashcodeIndex = configEntryData.metadata.names.indexOf("hashcode");
                let hashcodeData = configEntryData.data[0][hashcodeIndex];
                this.parameters.isConfLoadError = false;
                super.getWidgetConfiguration(this.props.widgetID)
                    .then((message) => {
                        let dataProviderConf = message.data;
                        let formattedQuery = dataProviderConf.configs.providerConfig.configs.config.queryData
                            .ENTRY_POINT_MESSAGE_FLOW_GET_AGGREGATE_DATA
                            .replace("{{timeUnit}}", timeUnit)
                            .replace("{{hashcode}}", '\'' + hashcodeData + '\'')
                            .replace("{{tenantId}}", tenantId)
                            .replace("{{timeTo}}", timeTo)
                            .replace("{{timeFrom}}", timeFrom);
                        dataProviderConf.configs.providerConfig.configs.config.queryData = {query: formattedQuery};
                        super.getWidgetChannelManager().subscribeWidget(
                            this.props.id,
                            (data) => this.handleAggregateData(configEntryData, entryName, data),
                            dataProviderConf.configs.providerConfig
                        );
                    })
                    .catch(() => {
                        this.parameters.isConfLoadError = true;
                    });
            } else {
                console.error("Data store returned with empty configuration data for " + this.props.widgetID);
            }
        }
    }

    handleAggregateData(configEntryData, entryName, aggregateData) {
        if (aggregateData != null && aggregateData.data.length !== 0) {
            this.setState({
                dataUnavailable: false
            });
            // Read and store column names and the position mapping in the data arrays
            let configEntryDataTableIndex = {};
            configEntryData.metadata.names.forEach((value, index) => {
                configEntryDataTableIndex[value] = index;
            });
            let schema = JSON.parse(configEntryData.data[0][configEntryDataTableIndex["configData"]]);
            // Aggregate table and prepare component map
            let result = [];
            let componentMap = {};
            let fields = ["invocations", "totalDuration", "maxDuration", "faults"];
            let table = aggregateData.data;
            if (table != null && table.length !== 0) {
                for (let j = 0; j < table.length; j++) {
                    let componentInfo = {};
                    // Replace number based indexing with label names
                    let row = table[j];
                    aggregateData.metadata.names.forEach((value, index) => {
                        componentInfo[value] = row[index];
                    });
                    let componentId = componentInfo["componentId"];
                    if (componentMap[componentId] == null) {
                        componentMap[componentId] = componentInfo;
                    } else {
                        for (let field in fields) {
                            fieldName = fields[field];
                            componentMap[componentId][fieldName] = componentMap[componentId][fieldName]
                                + componentInfo[fieldName];
                        }
                    }
                }
            }
            // Populate table data
            let componentNameRegex = new RegExp("^.*@\\d*:(.*)"); // Eg: HealthCareAPI@9:Resource
            let groups = [];
            for (let i = 0; i < schema.length; i++) {
                if (schema[i] != null) {
                    let componentId = schema[i]["id"];
                    /* change component id when @indirect presents */
                    let isIndirectComponent = componentId.indexOf("@indirect");
                    let originalCompId = componentId;
                    if (isIndirectComponent > 0) {
                        // PaymentServiceEp@14:PaymentServiceEp@indirect --> PaymentServiceEp@0:PaymentServiceEp
                        let splitByAt = componentId.split("@"); // ["PaymentServiceEp", "14:PaymentServiceEp", "indirect"]
                        let splitByColon = splitByAt[1].split(":"); // ["14", "PaymentServiceEp"]
                        componentId = splitByAt[0] + "@0:" + splitByColon[1];
                        /*
                            If any remaining entries in the schema has same name part'indirect',
                            replace it with the newly generated component id
                         */
                        for (let j = 0; j < schema.length; j++) {
                            if (schema[j] != null) {
                                let componentIdTmp = schema[j]["id"];
                                let componentIdParentTmp = schema[j]["parentId"];
                                let tempGroupId = schema[j]["group"];
                                if (componentIdTmp === componentId) {
                                    schema[j]["id"] = originalCompId;
                                } else if (componentIdParentTmp === componentId) {
                                    schema[j]["parentId"] = originalCompId;
                                }
                                if (tempGroupId === componentId) {
                                    schema[j]["group"] = originalCompId;
                                }
                            }
                        }
                    }
                    let componentInfo = componentMap[componentId];
                    let dataAttributes = [];
                    // Find unique groups
                    if (schema[i]["group"] != null && groups.indexOf(schema[i]["group"]) === -1) {
                        groups.push(schema[i]["group"]);
                    }
                    // Create data attributes
                    for (let field in fields) {
                        let fieldName = fields[field];
                        if (componentInfo != null) {
                            if (fieldName === "totalDuration") {
                                dataAttributes.push({ // Get the average values of multiple entries of the same path
                                    "name": "AvgDuration",
                                    "value": (componentInfo[fieldName] / componentInfo["invocations"]).toFixed(2)
                                });
                            } else {
                                dataAttributes.push({"name": fieldName, "value": componentInfo[fieldName]});
                            }
                        } else {
                            dataAttributes.push({"name": fieldName, "value": 0});
                        }
                    }
                    let componentLabel = componentNameRegex.exec(componentId)[1];
                    let componentType;
                    if (componentInfo != null) {
                        componentType = componentInfo["componentType"];
                    } else {
                        componentType = "UNKNOWN";
                    }
                    // Create hidden attributes
                    let hiddenAttributes = [];
                    hiddenAttributes.push({"name": "entryPoint", "value": entryName.slice(1, -1)});
                    if (componentType === "Endpoint" || componentType === "Sequence") {
                        hiddenAttributes.push({"name": "id", "value": componentLabel});
                    } else {
                        hiddenAttributes.push({"name": "id", "value": componentId});
                    }
                    if (schema[i]["parentId"] === schema[i]["group"]) {
                        result.push({
                            "id": originalCompId,
                            "label": componentLabel,
                            "parents": [],
                            "group": schema[i]["group"],
                            "type": componentType,
                            "dataAttributes": dataAttributes,
                            "hiddenAttributes": hiddenAttributes,
                            "modifiedId": componentId
                        });
                    } else {
                        result.push({
                            "id": originalCompId,
                            "label": componentLabel,
                            "parents": [schema[i]["parentId"]],
                            "group": schema[i]["group"],
                            "type": componentType,
                            "dataAttributes": dataAttributes,
                            "hiddenAttributes": hiddenAttributes,
                            "modifiedId": componentId
                        });
                    }
                }
            }
            // Defining groups
            for (let j = 0; j < result.length; j++) {
                if (groups.indexOf(result[j]["id"]) >= 0) {
                    result[j]["type"] = "group";
                }
            }
            // Draw message flow with the processed data
            this.drawMessageFlow($, result);
        } else {
            console.error("Data store returned with empty aggregation data for " + this.props.widgetID);
        }
    }

    /**
     * Draw graph for a flow of a message using the unique messageFlowID for the message.
     * @param messageFlowID Unique ID for the message flow
     * @param tenantId Tenant ID in a multiple tenant scenario
     */
    drawMessageFlowGraph(messageFlowID, tenantId) {
        // Set graph status to blank
        this.setState({
            dataUnavailable: true
        });
        // Set message flow id and make db call
        this.parameters.isConfLoadError = false;
        super.getWidgetConfiguration(this.props.widgetID)
            .then((message) => {
                let dataProviderConf = message.data;
                let query = dataProviderConf.configs.providerConfig.configs.config.queryData
                    .MESSAGE_FLOW_QUERY_GET_COMPONENTS;
                let formattedQuery = query
                    .replace("{{messageFlowId}}", "\'" + messageFlowID + "\'")
                    .replace("{{meta_tenantId}}", tenantId);
                dataProviderConf.configs.providerConfig.configs.config.queryData = {query: formattedQuery};
                super.getWidgetChannelManager()
                    .subscribeWidget(
                        this.props.id,
                        this.handleMessageFlowComponentsData(tenantId).bind(this),
                        dataProviderConf.configs.providerConfig
                    );
            })
            .catch(() => {
                this.parameters.isConfLoadError = true;
            });
    }

    /**
     *  Parse message flow components data and get schema for the message flow id
     */
    handleMessageFlowComponentsData(tenantId) {
        return (components) => {
            if (components != null && components.data.length !== 0) {
                let parsedComponents = this.parseDatastoreMessage(components);
                let entryPointHashCode = parsedComponents[0].entryPointHashcode;
                let entryPoint = parsedComponents[0].entryPoint;
                // Set query for schema and call data store for data
                this.parameters.isConfLoadError = false;
                super.getWidgetConfiguration(this.props.widgetID)
                    .then((message) => {
                        let dataProviderConf = message.data;
                        let query = dataProviderConf.configs.providerConfig.configs.config.queryData
                            .MESSAGE_FLOW_QUERY_GET_FLOW_SCHEMA;
                        dataProviderConf.configs.providerConfig.configs.config.queryData.query = query
                            .replace("{{hashcode}}", "\'" + entryPointHashCode + "\'")
                            .replace("{{meta_tenantId}}", tenantId);
                        let formattedProviderConfig = dataProviderConf.configs.providerConfig;
                        super.getWidgetChannelManager()
                            .subscribeWidget(
                                this.props.id,
                                this.handleMessageFlowSchema(parsedComponents, entryPoint, tenantId).bind(this),
                                formattedProviderConfig
                            );
                    })
                    .catch(() => {
                        this.parameters.isConfLoadError = true;
                    });

            } else {
                console.error("Data store returned with empty components for " + this.props.widgetID);
            }
        };
    }

    /**
     * Parse message flow schema and Get schemas for any existing sequences in the components
     */
    handleMessageFlowSchema(parsedComponents, entryPoint, tenantId) {
        return (flowSchema) => {
            if (flowSchema != null && flowSchema.data.length !== 0) {
                let parsedFlowScheme = this.parseDatastoreMessage(flowSchema);
                let sequenceComponentsQuery = "("; // Query for Components which are sequences
                parsedComponents.forEach((value) => {
                    if (value.componentType === "Sequence") {
                        sequenceComponentsQuery += ("hashcode=='" + value.hashCode + "' OR ");
                    }
                });
                // If sequences exists
                if (sequenceComponentsQuery.length > 0) {
                    sequenceComponentsQuery += "false) "; // To fix final 'OR' in the query
                    this.parameters.isConfLoadError = false;
                    super.getWidgetConfiguration(this.props.widgetID)
                        .then((message) => {
                            let dataProviderConf = message.data;
                            let query = dataProviderConf.configs.providerConfig.configs.config.queryData
                                .MESSAGE_FLOW_QUERY_GET_COMPONENT_SCHEMA;
                            dataProviderConf.configs.providerConfig.configs.config.queryData.query = query
                                .replace("{{sequences}}", sequenceComponentsQuery)
                                .replace("{{meta_tenantId}}", tenantId);
                            super.getWidgetChannelManager()
                                .subscribeWidget(
                                    this.props.id,
                                    this.handleMessageFlowComponentSchemas(parsedComponents, entryPoint, parsedFlowScheme).bind(this),
                                    dataProviderConf.configs.providerConfig
                                );
                        })
                        .catch(() => {
                            this.parameters.isConfLoadError = true;
                        });
                }
                else {
                    // If there are no sequences present, no need to make a DB call
                    this.handleMessageFlowComponentSchemas(parsedComponents, entryPoint, parsedFlowScheme)("");
                }
            } else {
                console.error("Data store returned with empty message flow schema for " + this.props.widgetID);
            }
        }
    }

    /**
     * Parse message flow schemas for sequence components and replace sequences with proper schemas
     * to build the message flow data. Then call graph draw function
     *
     * @param parsedComponents Components for the message flow id
     * @param entryPoint Message flow entry point
     * @param flowScheme Flow scheme for the message id
     */
    handleMessageFlowComponentSchemas(parsedComponents, entryPoint, flowScheme) {
        return (sequenceComponents) => {
            if (sequenceComponents == null || sequenceComponents.data.length === 0)
                sequenceComponents = "";
            this.setState({
                dataUnavailable: false
            });
            let parsedFlowScheme = JSON.parse(flowScheme[0].configData);
            let componentMap = {};
            let parsedSequenceComponents = [];
            if (sequenceComponents !== "") {
                parsedSequenceComponents = this.parseDatastoreMessage(sequenceComponents);
            }
            parsedComponents.forEach((component) => {
                if (component.componentType === "Sequence") {
                    // Find this sequence config data from the sequence components
                    for (let sequence of parsedSequenceComponents) {
                        if (sequence.hashcode === component.hashCode) {
                            // For each element in the sequence scheme, push it to the parsed flow scheme
                            sequence.configData.forEach((eachScheme) => {
                                parsedFlowScheme.push(eachScheme);
                            });
                            break;
                        }
                    }
                }
                componentMap[component.componentId] = component;
            });
            let result = [];
            let tmpResult = [];
            // Generate final flow with the extracted data...
            let removedComponents = [];
            // Populate table data
            let componentNameRegex = new RegExp("^.*@\\d*:(.*)");
            let groups = [];
            let compIds = [];
            let schema = parsedFlowScheme;
            for (let i = 0; i < schema.length; i++) {
                if (schema[i] != null) {
                    let componentId = schema[i]["id"];
                    let isIndirectComponent = componentId.indexOf("@indirect");
                    let originalCompId = componentId;
                    if (isIndirectComponent > 0) {
                        // PaymentServiceEp@14:PaymentServiceEp@indirect --> PaymentServiceEp@0:PaymentServiceEp
                        let splitByAt = componentId.split("@"); // ["PaymentServiceEp", "14:PaymentServiceEp", "indirect"]
                        let splitByColon = splitByAt[1].split(":"); // ["14", "PaymentServiceEp"]
                        componentId = splitByAt[0] + "@0:" + splitByColon[1];
                        for (let j = 0; j < schema.length; j++) {
                            if (schema[j] != null) {
                                let componentIdTmp = schema[j]["id"];
                                let componentIdParentTmp = schema[j]["parentId"];
                                let tempGroupId = schema[j]["group"];
                                if (componentIdTmp === componentId) {
                                    schema[j]["id"] = originalCompId;
                                }
                                if (componentIdParentTmp === componentId) {
                                    schema[j]["parentId"] = originalCompId;
                                }
                                if (tempGroupId === componentId) {
                                    schema[j]["group"] = originalCompId;
                                }
                            }
                        }
                    }
                    let componentInfo = null;
                    if (componentId != null) {
                        componentInfo = componentMap[componentId];
                    }
                    let dataAttributes = [];
                    let hiddenAttributes = [];
                    let componentLabel = componentNameRegex.exec(componentId)[1];
                    // Find unique groups
                    if (schema[i]["group"] != null && groups.indexOf(schema[i]["group"]) === -1) {
                        groups.push(schema[i]["group"]);
                    }
                    // Create data attributes
                    if (componentInfo != null) {
                        dataAttributes.push({"name": "Duration", "value": componentInfo["duration"]});
                        if (componentInfo["faultCount"] === 0) {
                            dataAttributes.push({"name": "Status", "value": "Success"});
                        } else {
                            dataAttributes.push({"name": "Status", "value": "Failed"});
                        }
                        let componentType = componentInfo["componentType"];
                        let hashCode = componentInfo["hashCode"];
                        hiddenAttributes.push({"name": "entryPoint", "value": entryPoint});
                        hiddenAttributes.push({"name": "hashCode", "value": hashCode});
                        // for Sequences and Endpoints, id should be the "name", since name is used for drill down searches
                        if (componentType === "Endpoint" || componentType === "Sequence") {
                            hiddenAttributes.push({"name": "id", "value": componentLabel});
                        } else {
                            hiddenAttributes.push({"name": "id", "value": componentId});
                        }
                        let compId = schema[i]["id"];
                        let parentId = schema[i]["parentId"];
                        if (compIds.indexOf(compId) < 0) {
                            compIds.push(compId);
                        }
                        if (parentId != null && (compIds.indexOf(parentId) < 0)) {
                            let matchingParentId;
                            // This logic traverse towards the root of the configuration tree from
                            // the current node, until it finds the parent of the node or any ancestor node
                            // exists within the message flow. If any node found, it assigns the node as
                            // its parent.  This link is used to draw the message flow.
                            for (let j = 1; j < schema.length; j++) {
                                if (compIds.indexOf(schema[i - j]["parentId"]) !== -1) {
                                    matchingParentId = schema[i - j]["parentId"];
                                    break;
                                }
                            }
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [matchingParentId],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        } else if (schema[i]["parentId"] === schema[i]["group"]) {
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        } else {
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [schema[i]["parentId"]],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        }
                    } else {
                        removedComponents.push(componentId);
                    }
                }
            }
            compIds = null;
            // Cleanup
            for (let k = 0; k < tmpResult.length; k++) {
                let group = tmpResult[k]["group"];
                let parentId = tmpResult[k]["parents"];
                if (removedComponents.indexOf(group) === -1 && removedComponents.indexOf(parentId[0]) === -1) {
                    result.push(tmpResult[k]);
                }
            }
            for (let j = 0; j < result.length; j++) {
                if (groups.indexOf(result[j]["id"]) >= 0) {
                    result[j]["type"] = "group";
                }
            }
            // Draw graph
            this.drawMessageFlow($, result);
        }
    }

    /**
     * Get most recent config data for a given entryName and pass it to the relevant data handler
     *
     * @param timeFrom Time duration start position
     * @param timeTo Time duration end position
     * @param timeUnit Per which time unit, data should be retrieved(minutes, seconds etc)
     * @param entryName Name of the component
     * @param tenantId Id of the tenant
     */
    drawSequenceMessageFlowGraph(timeFrom, timeTo, timeUnit, entryName, tenantId) {
        // Extract latest configEntry data row from the datastore
        this.setState({
            dataUnavailable: true
        });
        let handleConfigData = this.handleSequenceMessageFlowSchema(timeUnit, timeFrom, timeTo, tenantId).bind(this);
        this.parameters.isConfLoadError = false;
        super.getWidgetConfiguration(this.props.widgetID)
            .then((message) => {
                let dataProviderConf = message.data;
                let query = dataProviderConf.configs.providerConfig.configs.config.queryData
                    .GET_CONFIG_ENTRY_DATA;
                let formattedQuery = query
                    .replace("{{entryName}}", entryName)
                    .replace("{{meta_tenantId}}", tenantId)
                    .replace("{{timeFrom}}", timeFrom)
                    .replace("{{timeTo}}", timeTo);
                dataProviderConf.configs.providerConfig.configs.config.queryData = {query: formattedQuery};
                super.getWidgetChannelManager().subscribeWidget(
                    this.props.id,
                    handleConfigData,
                    dataProviderConf.configs.providerConfig
                );
            })
            .catch(() => {
                this.parameters.isConfLoadError = true;
            });
    }

    handleSequenceMessageFlowSchema(timeUnit, timeFrom, timeTo, tenantId) {
        return (schemaData) => {
            if (schemaData != null && schemaData.data.length !== 0) {
                let parsedSchemaData = this.parseDatastoreMessage(schemaData)[0]; // Get latest schema data
                let artifactFirstEntryTime = moment(parsedSchemaData._timestamp).format("YYYY-MM-DD HH:mm:ss");
                let schema = JSON.parse(parsedSchemaData.configData);
                let componentIdQuery = "(";
                for (let j = 0; j < schema.length; j++) {
                    if (schema[j] != null) {
                        let componentId = schema[j]["id"];
                        let isIndirectComponent = componentId.indexOf("@indirect");
                        if (isIndirectComponent > 0) {
                            // PaymentServiceEp@14:PaymentServiceEp@indirect --> PaymentServiceEp@0:PaymentServiceEp
                            let splitByAt = componentId.split("@"); // ["PaymentServiceEp", "14:PaymentServiceEp", "indirect"]
                            let splitByColon = splitByAt[1].split(":"); // ["14", "PaymentServiceEp"]
                            componentId = splitByAt[0] + "@0:" + splitByColon[1];
                        }
                        componentIdQuery += "componentId=='" + componentId + "' OR ";
                    }
                }
                componentIdQuery += "false) "; // Fix final 'AND' in the query
                // get components info from different tables
                let dataFetchTime = artifactFirstEntryTime;
                if (moment(timeFrom.replace(/'/g, '')).isBefore(artifactFirstEntryTime)) {
                    dataFetchTime = timeFrom;
                }
                else {
                    dataFetchTime = "\'" + artifactFirstEntryTime + "\'";
                }
                this.parameters.isConfLoadError = false;
                super.getWidgetConfiguration(this.props.widgetID)
                    .then((message) => {
                        let dataProviderConf = message.data;
                        let query = dataProviderConf.configs.providerConfig.configs.config.queryData
                            .SEQUENCE_MESSAGE_FLOW_QUERY_GET_AGGREGATE_DATA;
                        let formattedQuery = query
                            .replace("{{componentIDs}}", componentIdQuery)
                            .replace("{{timeUnit}}", timeUnit)
                            .replace("{{tenantId}}", tenantId)
                            .replace("{{timeTo}}", timeTo)
                            .replace("{{timeFrom}}", dataFetchTime);
                        dataProviderConf.configs.providerConfig.configs.config.queryData = {query: formattedQuery};
                        super.getWidgetChannelManager().subscribeWidget(
                            this.props.id,
                            this.handleSequenceMessageFlowAggregateData(schema).bind(this),
                            dataProviderConf.configs.providerConfig
                        );
                    })
                    .catch(() => {
                        this.parameters.isConfLoadError = true;
                    });
            } else {
                console.error("Data store returned with empty message flow schema for " + this.props.widgetID);
            }
        }
    }

    /**
     * Combine aggregate data and generate message flow data array. Then call graph draw function
     *
     * @returns {Function}
     */
    handleSequenceMessageFlowAggregateData(schema) {
        return (aggregatedData) => {
            if (aggregatedData != null && aggregatedData.data.length !== 0) {
                this.setState({
                    dataUnavailable: false
                });
                let parsedAggregateData = this.parseDatastoreMessage(aggregatedData);
                let componentMap = {};
                parsedAggregateData.forEach((eachComponent) => {
                    componentMap[eachComponent.componentId] = eachComponent;
                });
                let fields = ["invocations", "totalDuration", "maxDuration", "faults"];
                let result = [];
                // Populate table data
                let componentNameRegex = new RegExp("^.*@\\d*:(.*)");
                let groups = [];
                for (let i = 0; i < schema.length; i++) {
                    let componentId = schema[i]["id"];
                    let isIndirectComponent = componentId.indexOf("@indirect");
                    let originalCompId = componentId;
                    if (isIndirectComponent > 0) {
                        // PaymentServiceEp@14:PaymentServiceEp@indirect --> PaymentServiceEp@0:PaymentServiceEp
                        let splitByAt = componentId.split("@"); // ["PaymentServiceEp", "14:PaymentServiceEp", "indirect"]
                        let splitByColon = splitByAt[1].split(":"); // ["14", "PaymentServiceEp"]
                        componentId = splitByAt[0] + "@0:" + splitByColon[1];
                        for (let j = 0; j < schema.length; j++) {
                            if (schema[j] != null) {
                                let componentIdTmp = schema[j]["id"];
                                let componentIdParentTmp = schema[j]["parentId"];
                                let tempGroupId = schema[j]["group"];
                                if (componentIdTmp === componentId) {
                                    schema[j]["id"] = originalCompId;
                                } else if (componentIdParentTmp === componentId) {
                                    schema[j]["parentId"] = originalCompId;
                                }
                                if (tempGroupId === componentId) {
                                    schema[j]["group"] = originalCompId;
                                }
                            }
                        }
                    }
                    let componentInfo = componentMap[componentId];
                    let dataAttributes = [];
                    // Find unique groups
                    if (schema[i]["group"] != null && groups.indexOf(schema[i]["group"]) === -1) {
                        groups.push(schema[i]["group"]);
                    }
                    // Create data attributes
                    for (let field in fields) {
                        let fieldName = fields[field];
                        if (componentInfo != null) {
                            if (fieldName === "TotalDuration") {
                                dataAttributes.push({
                                    "name": "AvgDuration",
                                    "value": (componentInfo[fieldName] / componentInfo["Invocations"]).toFixed(2)
                                });
                            } else {
                                dataAttributes.push({"name": fieldName, "value": componentInfo[fieldName]});
                            }
                        } else {
                            dataAttributes.push({"name": fieldName, "value": 0});
                        }
                    }
                    let componentLabel = componentNameRegex.exec(componentId)[1];
                    let componentType;
                    if (componentInfo != null) {
                        componentType = componentInfo["componentType"];
                    } else {
                        componentType = "UNKNOWN";
                    }
                    // Create hidden attributes
                    let hiddenAttributes = [];
                    if (componentInfo != null) {
                        hiddenAttributes.push({"name": "entryPoint", "value": componentInfo["entryPoint"]});
                    }
                    if (componentType === "Endpoint" || componentType === "Sequence") {
                        hiddenAttributes.push({"name": "id", "value": componentLabel});
                    } else {
                        hiddenAttributes.push({"name": "id", "value": componentId});
                    }
                    if (schema[i]["parentId"] === schema[i]["group"]) {
                        result.push({
                            "id": originalCompId,
                            "label": componentLabel,
                            "parents": [],
                            "group": schema[i]["group"],
                            "type": componentType,
                            "dataAttributes": dataAttributes,
                            "hiddenAttributes": hiddenAttributes,
                            "modifiedId": componentId
                        });
                    } else {
                        result.push({
                            "id": originalCompId,
                            "label": componentLabel,
                            "parents": [schema[i]["parentId"]],
                            "group": schema[i]["group"],
                            "type": componentType,
                            "dataAttributes": dataAttributes,
                            "hiddenAttributes": hiddenAttributes,
                            "modifiedId": componentId
                        });
                    }
                }
                // Defining groups
                for (let j = 0; j < result.length; j++) {
                    if (groups.indexOf(result[j]["id"]) >= 0) {
                        result[j]["type"] = "group";
                    }
                }
                this.drawMessageFlow($, result);
            } else {
                console.error("Data store returned with empty aggregation data for " + this.props.widgetID);
            }
        }
    }

    /**
     * Parse received data from the data store to a JS object
     */
    parseDatastoreMessage(receivedData) {
        let parsedArray = [];
        let dataMapper = {};
        let dataArray = receivedData.data;
        let metaData = receivedData.metadata.names;
        metaData.forEach((value, index) => {
            dataMapper[index] = value;
        });
        dataArray.forEach((dataPoint) => {
            let parsedObject = {};
            dataPoint.forEach((value, index) => {
                parsedObject[dataMapper[index]] = value;
            });
            parsedArray.push(parsedObject);
        });
        return parsedArray;
    }

    detectIE() {
        let ua = window.navigator.userAgent;
        let msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }
        let trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            let rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }
        let edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }
        // other browser
        return false;
    }

    buildLabel(node, $) {
        let pageUrl = MEDIATOR_PAGE_URL;
        if (node.type === "Sequence") {
            pageUrl = SEQUENCE_PAGE_URL;
        } else if (node.type === "Endpoint") {
            pageUrl = ENDPOINT_PAGE_URL;
        }
        let hashCode = "";
        let existingUrlHash = decodeURIComponent(window.location.hash);
        let hashComponent = existingUrlHash === "" ? {} : JSON.parse(existingUrlHash.substring(1));
        if (node.hiddenAttributes) {
            node.hiddenAttributes.forEach((item) => {
                hashComponent[getKey("mediator", item.name)] = item.value;
                if (item.name === "hashCode") {
                    hashCode = item.value;
                }
            });
        }
        let targetUrl = pageUrl + encodeURI('#' + JSON.stringify(hashComponent));
        let labelText;
        if (node.dataAttributes) {
            let nodeClasses = "nodeLabel";
            let nodeWrapClasses = "nodeLabelWrap";

            if (node.dataAttributes[1].value === "Failed") {
                nodeClasses += " failed-node";
                nodeWrapClasses += " failed-node";
            }
            let icon;
            if (node.type.toLowerCase() === 'mediator') {
                let mediatorName = node.label.split(':')[0].toLowerCase();
                let imgURL = '/portal/public/app/images/mediators/' + mediatorName + '.svg';
                let defaultImgURL = '/portal/public/app/images/mediators/mediator.svg';
                $.ajax({
                    url: imgURL,
                    async: false,
                    success: function (data) {
                        let $svg = $(data).find('svg');
                        $svg = $svg.removeAttr('xmlns:a');
                        if (!$svg.attr('viewBox') && $svg.attr('height') && $svg.attr('width')) {
                            $svg.attr('viewBox', '0 0 ' + $svg.attr('height') + ' ' + $svg.attr('width'))
                        }

                        icon = $svg.get(0).outerHTML;
                    },
                    error: function () {
                        $.ajax({
                            url: defaultImgURL,
                            async: false,
                            success: function (data) {
                                let $svg = $(data).find('svg');
                                $svg = $svg.removeAttr('xmlns:a');
                                if (!$svg.attr('viewBox') && $svg.attr('height') && $svg.attr('width')) {
                                    $svg.attr('viewBox', '0 0 ' + $svg.attr('height') + ' ' + $svg.attr('width'))
                                }

                                icon = $svg.get(0).outerHTML;
                            },
                            dataType: 'xml'
                        });
                    },
                    dataType: 'xml'
                });
                //icon = '<img class="mediator-icon" src="' + imgURL + '" onerror="this.src="' + defaultImgURL + '">';
            } else if (node.type.toLowerCase() === 'endpoint') {
                icon = '<i class="icon endpoint-icon fw fw-endpoint"></i>';
            } else {
                icon = '';
            }
            labelText = '<a href="#" class="' + nodeWrapClasses + '">' + icon + '<div class="' + nodeClasses + '" data-node-type="' + node.type + '" data-component-id="' + node.modifiedId
                + '" data-hash-code="' + hashCode + '" data-target-url="' + targetUrl + '"><h4>' + node.label + "</h4>";
            node.dataAttributes.forEach(function (item) {
                labelText += "<h5><label>" + item.name + " : </label><span>" + item.value + "</span></h5>";
            });
        }
        labelText += "</div></a>";
        return labelText;
    };

    interpolateZoom(translate, scale, svg, zoom) {
        //var self = this;
        return d3.transition().duration(350).tween("zoom", function () {
            let iTranslate = d3.interpolate(zoom.translate(), translate),
                iScale = d3.interpolate(zoom.scale(), scale);
            return function (t) {
                zoom.scale(iScale(t)).translate(iTranslate(t));
                svg.attr("transform", d3.event.transform)
            };
        });
    }

    isParent(searchNodes, id) {
        for (let x = 0; x < searchNodes.length; x++) {
            if (searchNodes[x].parent === id) {
                return true;
            }
        }
        return false;
    }

    renderEmptyRecordsMessage() {
        return (
            <div style={{margin: "10px", boxSizing: "border-box"}}>
                <div style={{height: "100%", width: "100%"}}>
                    <div style={{
                        display: "flex",
                        justifyContent: "center",
                        background: "rgb(158, 158, 158)",
                        color: "rgb(0, 0, 0)",
                        fontWeight: "500"
                    }}>
                        {
                            this.parameters.isConfLoadError ? 'No configurations available' : 'No data available'
                        }
                    </div>
                </div>
            </div>
        );
    }

    componentWillMount() {
        super.subscribe(this.handleRecievedMessage);
    }

    componentDidMount() {
        // Draw message flow in the message page with component load
        if (this.getCurrentPage() === TYPE_MESSAGE) {
            let entry = super.getGlobalState(getKey("message", "id"));
            this.drawMessageFlowGraph(
                entry,
                DEFAULT_META_TENANT_ID
            );
        }
    }

    handleMessage(recievedMessage) {
        let message;
        if (typeof recievedMessage === "string") {
            message = JSON.parse(recievedMessage);
        }
        else {
            message = recievedMessage;
        }
        if ("granularity" in message) {
            this.parameters.timeFrom = '\'' + moment(message.from).format("YYYY-MM-DD HH:mm:ss") + '\'';
            this.parameters.timeTo = '\'' + moment(message.to).format("YYYY-MM-DD HH:mm:ss") + '\'';
            this.parameters.timeUnit = '\'' + message.granularity + 's' + '\'';
        }
        if ("selectedComponent" in message) {
            this.parameters.selectedComponantID = '\'' + message.selectedComponent + '\'';
        }
        $(this.domElementSvg).empty();
        if (this.parameters.timeFrom != null
            && this.parameters.timeTo != null
            && this.parameters.timeUnit != null
            && this.parameters.selectedComponantID != null) {
            switch (this.getCurrentPage()) {
                case TYPE_API:
                case TYPE_PROXY:
                case TYPE_INBOUND_ENDPOINT:
                    this.drawEntryPointMessageFlowGraph(
                        this.parameters.timeFrom,
                        this.parameters.timeTo,
                        this.parameters.timeUnit,
                        this.parameters.selectedComponantID,
                        this.parameters.meta_tenantId
                    );
                    break;
                case TYPE_SEQUENCE:
                    this.drawSequenceMessageFlowGraph(
                        this.parameters.timeFrom,
                        this.parameters.timeTo,
                        this.parameters.timeUnit,
                        this.parameters.selectedComponantID,
                        this.parameters.meta_tenantId
                    );
                    break;
            }
        }
    }

    noParameters() {
        let page = this.getCurrentPage();
        let pageName = (page == null) ? '' : page;
        switch (pageName) {
            case 'api':
                return 'Please select an API and a valid date range to view stats.';
            case 'proxy':
                return 'Please select a Proxy Service and a valid date range to view stats.';
            case 'sequence':
                return 'Please select a Sequence and a valid date range to view stats.';
            case 'endpoint':
                return 'Please select an Endpoint and a valid date range to view stats.';
            case 'inboundEndpoint':
                return 'Please select an Inbound Endpoint and a valid date range to view stats.';
            default:
                return 'Please select a valid date range to view stats';
        }
    }

    getCurrentPage() {
        return window.location.pathname.split('/').pop();
    };

    render() {
        return (
            <Scrollbars style={{width: "100%"}}>
                <div className="nano" ref={input => (this.domElementNano = input)}>
                    <div className="nano-content">
                        <div className="page-content-wrapper">
                            <div className="zoom-panel">
                                <button className="btn-zoom" id="btnZoomIn"
                                        ref={input => (this.domElementBtnZoomIn = input)}>+
                                </button>
                                <br/>
                                <button className="btn-zoom" id="btnZoomOut"
                                        ref={input => (this.domElementBtnZoomOut = input)}>-
                                </button>
                                <br/>
                                <button className="btn-zoom" id="btnZoomFit"
                                        ref={input => (this.domElementBtnZoomFit = input)}>
                                    <i className="fw fw-square-outline"></i>
                                </button>
                            </div>
                            <div id="canvas" ref={input => (this.domElementCanvas = input)}>
                                {
                                    this.state.dataUnavailable === true ? this.renderEmptyRecordsMessage() : null
                                }
                            </div>
                            <div style={svgCenter}>
                                <svg id="svg-canvas" width="100%" height="100%"
                                     ref={input => (this.domElementSvg = input)}/>
                            </div>
                        </div>
                    </div>
                </div>
            </Scrollbars>
        );
    }
}

function getKey(pageName, parameter) {
    return pageName + "_page_" + parameter;
}

global.dashboard.registerWidget('EIAnalyticsMessageFlow', EIAnalyticsMessageFlow);
