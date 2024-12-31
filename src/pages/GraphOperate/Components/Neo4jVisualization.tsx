import React, { useRef, useEffect, useState } from 'react';
import { Button, Card, Descriptions, Row, Col } from 'antd';
import { Network, DataSet } from 'vis-network/standalone/esm/vis-network';
import 'vis-network/styles/vis-network.css';

import {
  createNode, deleteNode, updateNode, findNode,
  getAllNodes,
  createRelationship, deleteRelationship, updateRelationship, findRelationship,
  getAllRelationships
} from '@/pages/GraphOperate/Components/apiFunctions';

// 定义节点的接口
interface Node {
  name: string; // 节点的名称
  properties: { [key: string]: any }; // 节点的属性
}

// 定义关系的接口
interface Relationship {
  name: string; // 关系的名称
  properties: { [key: string]: any }; // 关系的属性
}

// 定义组件的属性接口
interface Neo4jVisualizationProps {
  nodes?: Node[]; // 可选的节点数组
  relationships?: Relationship[]; // 可选的关系数组
}

const Neo4jVisualization: React.FC<Neo4jVisualizationProps> = ({ nodes = [], relationships = [] }) => {
  const cardRef = useRef<HTMLDivElement>(null); // 用于引用图表容器的 ref
  const networkRef = useRef<Network | null>(null); // 用于引用 vis-network 实例的 ref
  const [selectedNode, setSelectedNode] = useState<Node | null>(null); // 当前选中的节点
  const [selectedLink, setSelectedLink] = useState<Relationship | null>(null); // 当前选中的关系

  const [newRelationshipsToSave, setNewRelationshipsToSave] = useState<Relationship[]>([]); // 用于存储待保存的新关系
  const [newNodesToSave, setNewNodesToSave] = useState<Node[]>([]); // 用于存储待保存的新节点

  // 将 useEffect 中的逻辑提取成独立函数，并使其异步
  const initializeGraph = async (nodes: Node[], relationships: Relationship[]): Promise<void> => {
    console.log('Nodes:', nodes);
    console.log('Relationships:', relationships);


    const excludedProperties = ['annotatedImage', 'ImgName'];
    if (cardRef.current) {
      const container = cardRef.current; // 获取图表容器的 DOM 元素

      const propertyToNodesMap: { [key: string]: Node[] } = {};
      const newNodes: Node[] = [];
      const newRelationships: Relationship[] = [];

      nodes.forEach(node => {
        Object.entries(node.properties).forEach(([key, value]) => {
          if (excludedProperties.includes(key)) {
            return;
          }
          const propertyValue = `${key}:${value}`;
          if (!propertyToNodesMap[propertyValue]) {
            propertyToNodesMap[propertyValue] = [];
          }
          propertyToNodesMap[propertyValue].push(node);
        });
      });

      // 为每个属性值创建节点和关系
      for (const [propertyValue, nodes] of Object.entries(propertyToNodesMap)) {
        if (nodes.length > 1) {
          const [key, value] = propertyValue.split(':');
          const newNode: Node = {
            name: propertyValue, // 使用属性名和属性值作为新节点的名称
            properties: {
              belongTo: key
            },
          };

          // 检查新节点是否已经存在，考虑 name 和 properties.belongTo
          const existingNode = newNodes.find(n => n.name === newNode.name && n.properties.belongTo === newNode.properties.belongTo);
          if (!existingNode) {
            newNodes.push(newNode);
            await createNode(newNode); // 等待创建节点完成
          }

          // 创建关系
          for (const node of nodes) {
            const newRelationship: Relationship = {
              name: key,
              properties: {
                fromNode: node.name,
                toNode: newNode.name,
              },
            };
            newRelationships.push(newRelationship);
            await createRelationship(newRelationship); // 等待创建关系完成
          }
        } else {
          const [key, value] = propertyValue.split(':');
          const newNode: Node = {
            name: propertyValue, // 使用属性名和属性值作为新节点的名称
            properties: {
              belongTo: key
            },
          };
          await createNode(newNode); // 等待创建节点完成

          // 检查新节点是否已存在
          const existingNode = newNodes.find(n => n.name === newNode.name && n.properties.belongTo === newNode.properties.belongTo);
          if (!existingNode) {
            newNodes.push(newNode);
          }

          const node = nodes[0];
          const newRelationship: Relationship = {
            name: key,
            properties: {
              fromNode: node.name,
              toNode: newNode.name,
            },
          };
          newRelationships.push(newRelationship);
          await createRelationship(newRelationship); // 等待创建关系完成
        }
      }

      // 将节点数据转换为 vis-network 所需的格式
      const visNodes = new DataSet([
        ...nodes.map(node => ({
          id: node.name,
          label: node.name,
          ...node.properties,
          shape: 'ellipse',
          color: {
            background: '#AED6F1',
            border: '#3498DB',
            highlight: {
              background: '#85C1E9',
              border: '#2980B9',
            },
          },
          borderWidth: 2,
          font: {
            size: 14,
            color: '#333333',
          },
        })),
        ...newNodes.map(node => ({
          id: `${node.name}-${node.properties.belongTo}`,
          label: node.name.split(':')[1],
          ...node.properties,
          shape: 'box',
          font: {
            size: 14,
            color: '#333333',
            align: 'middle',
            vadjust: 0,
          },
          color: {
            background: '#A9DFBF',
            border: '#27AE60',
            highlight: {
              background: '#7DCEA0',
              border: '#1E8449',
            },
          },
          borderWidth: 2,
        })),
      ]);

      let edgeIdCounter = 0;
      const visEdges = new DataSet([
        ...relationships.map(rel => {
          const sourceNode = nodes.find(node => node.name === rel.properties.fromNode);
          const targetNode = nodes.find(node => node.name === rel.properties.toNode);
          if (sourceNode && targetNode) {
            return {
              id: `edge-${edgeIdCounter++}`,
              from: sourceNode.name,
              to: targetNode.name,
              label: rel.name,
              ...rel.properties,
            };
          } else {
            console.warn(`Skipping relationship ${rel.name} because one or both nodes are missing.`);
            return null;
          }
        }).filter(link => link !== null) as { id: string; from: string; to: string; label: string }[],
        ...newRelationships.map(rel => {
          const sourceNode = nodes.find(node => node.name === rel.properties.fromNode);
          const targetNode = newNodes.find(node => node.name === rel.properties.toNode);
          if (sourceNode && targetNode) {
            return {
              id: `edge-${edgeIdCounter++}`,
              from: sourceNode.name,
              to: `${targetNode.name}-${targetNode.properties.belongTo}`,
              label: rel.name,
              ...rel.properties,
            };
          } else {
            console.warn(`Skipping relationship ${rel.name} because one or both nodes are missing.`);
            return null;
          }
        }).filter(link => link !== null) as { id: string; from: string; to: string; label: string }[],
      ]);

      const data = {
        nodes: visNodes,
        edges: visEdges,
      };

      const options = {
        interaction: {
          dragNodes: true,
          dragView: true,
          hover: true,
        },
        physics: {
          enabled: true,
          barnesHut: {
            gravitationalConstant: -200,
            centralGravity: 0,
            springLength: 200,
            springConstant: 0.04,
            damping: 0.09,
            avoidOverlap: 0.5,
          },
        },
        nodes: {
          shape: 'dot',
          size: 20,
          font: {
            size: 12,
          },
          borderWidth: 2,
          color: {
            background: 'lightgreen',
            border: 'green',
            highlight: {
              background: 'lightblue',
              border: 'blue',
            },
          },
        },
        edges: {
          arrows: {
            to: {
              enabled: true,
              scaleFactor: 0.5,
            },
          },
          color: {
            color: '#848484',
            highlight: '#848484',
            hover: '#848484',
          },
          font: {
            size: 14,
            align: 'middle',
          },
        },
      };

      if (networkRef.current) {
        networkRef.current.destroy(); // 销毁之前的网络实例
      }

      networkRef.current = new Network(container, data, options); // 创建新的网络实例

      networkRef.current.on('selectNode', params => {
        const nodeId = params.nodes[0];
        const selectedNode = nodes.find(node => node.name === nodeId);
        setSelectedNode(selectedNode || null);
      });

      networkRef.current.on('selectEdge', params => {
        if (params.edges.length > 0) {
          const edgeId = params.edges[0];
          const selectedLink = relationships.find(rel => rel.name === edgeId);
          setSelectedLink(selectedLink || null);
        }
      });
    }
  };

  const handleInitializeGraph = async () => {
    try {
      await initializeGraph(nodes, relationships); // 等待初始化完成
      console.log('Graph initialized');
    } catch (error) {
      console.error('Error initializing graph:', error);
    }
  };

  useEffect(() => {
    // 初始化图表时自动加载
    initializeGraph(nodes, relationships);
  }, [nodes, relationships]);

  return (
    <Row gutter={16}>
      {/* 左侧的 Card，用来显示图表 */}
      <Col span={16}>
        <Card title="Neo4j Visualization">
          <div ref={cardRef} style={{ width: '100%', height: '600px' }}></div>
          <Descriptions title="Selected Node" column={2}>
            {selectedNode && (
              <>
                <Descriptions.Item label="Node Name">{selectedNode.name}</Descriptions.Item>
                <Descriptions.Item label="Properties">
                  {Object.entries(selectedNode.properties).map(([key, value]) => (
                    <div key={key}>
                      {key}: {value}
                    </div>
                  ))}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>
      </Col>

      {/* 右侧的 Card，用来放按钮 */}
      <Col span={8}>
        <Card title="Actions">
          <Button type="primary" onClick={handleInitializeGraph}>
            Initialize Graph
          </Button>
        </Card>
      </Col>
    </Row>
  );
};

export default Neo4jVisualization;
