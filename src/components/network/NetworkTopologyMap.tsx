import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CyberDefenseState, InterventionAction } from '../../types/cyberDefense';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Server,
  Database,
  Lock,
  Zap,
  Globe,
  Radio,
  Cpu,
  Activity,
  Maximize2,
  Minimize2,
  Eye,
  Crosshair,
  AlertTriangle
} from 'lucide-react';

export type AttackVectorType = 'DDOS' | 'RECON' | 'EXFILTRATION';

export interface TopologyNode {
  id: string;
  name: string;
  ip: string;
  zone: 1 | 2 | 3 | 4;
  zoneName: string;
  x: number;
  y: number;
  role: string;
  metrics: {
    cpu?: number;
    bandwidth?: string;
    connections?: number;
    dropRate?: number;
    latencyMs?: number;
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'ISOLATED' | 'SINKHOLED';
  };
}

interface NetworkTopologyMapProps {
  state: CyberDefenseState;
  selectedAction?: InterventionAction;
  onSelectNode?: (node: TopologyNode) => void;
  activeAttackVector?: AttackVectorType;
  height?: string;
  compact?: boolean;
}

export const NetworkTopologyMap: React.FC<NetworkTopologyMapProps> = ({
  state,
  selectedAction = 'ISOLATE_SERVER',
  onSelectNode,
  activeAttackVector = 'DDOS',
  height = 'h-[500px]',
  compact = false
}) => {
  // Layer visibility toggles
  const [showTraffic, setShowTraffic] = useState<boolean>(true);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [currentVector, setCurrentVector] = useState<AttackVectorType>(activeAttackVector);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Sync vector prop changes
  useEffect(() => {
    setCurrentVector(activeAttackVector);
  }, [activeAttackVector]);

  // Initial 4-Zone Node Coordinates
  const initialNodes: Record<string, TopologyNode> = {
    'node-botnet': {
      id: 'node-botnet',
      name: 'Attacker Botnet C2',
      ip: '198.51.100.0/24',
      zone: 1,
      zoneName: 'Zone 1: External / Untrusted',
      x: 80,
      y: 110,
      role: 'Ingress attack source',
      metrics: { bandwidth: '4.8 Gbps', connections: 54200, status: 'CRITICAL' }
    },
    'node-clients': {
      id: 'node-clients',
      name: 'Legitimate User Traffic',
      ip: '172.16.0.0/16',
      zone: 1,
      zoneName: 'Zone 1: External / Untrusted',
      x: 80,
      y: 340,
      role: 'Baseline user sessions',
      metrics: { bandwidth: '320 Mbps', connections: 4200, status: 'HEALTHY' }
    },
    'node-firewall': {
      id: 'node-firewall',
      name: 'Edge Firewall / WAF',
      ip: '10.0.0.1',
      zone: 2,
      zoneName: 'Zone 2: DMZ / Ingress',
      x: 300,
      y: 200,
      role: 'Ingress filter & BGP sinkhole',
      metrics: {
        dropRate: selectedAction === 'BLOCK_SOURCES' ? 94.2 : 4.1,
        connections: 58400,
        status: selectedAction === 'BLOCK_SOURCES' ? 'HEALTHY' : 'DEGRADED'
      }
    },
    'node-sinkhole': {
      id: 'node-sinkhole',
      name: 'BGP Sinkhole Node',
      ip: '10.0.255.255',
      zone: 2,
      zoneName: 'Zone 2: DMZ / Ingress',
      x: 300,
      y: 380,
      role: 'Malicious traffic blackhole',
      metrics: { bandwidth: selectedAction === 'ISOLATE_SERVER' ? '4.5 Gbps' : '0 Mbps', status: 'SINKHOLED' }
    },
    'node-gateway': {
      id: 'node-gateway',
      name: 'API Gateway Router',
      ip: '10.0.1.50',
      zone: 3,
      zoneName: 'Zone 3: App Tier',
      x: 520,
      y: 160,
      role: 'Rate limiter & router',
      metrics: { connections: 12400, status: selectedAction === 'NO_ACTION' ? 'CRITICAL' : 'HEALTHY' }
    },
    'node-app-server': {
      id: 'node-app-server',
      name: 'Target App Server',
      ip: '10.0.2.100',
      zone: 3,
      zoneName: 'Zone 3: App Tier',
      x: 520,
      y: 320,
      role: 'Primary target application host',
      metrics: {
        cpu: selectedAction === 'NO_ACTION' ? 98 : selectedAction === 'BLOCK_SOURCES' ? 39 : 18,
        connections: selectedAction === 'NO_ACTION' ? 48000 : 1200,
        status: selectedAction === 'NO_ACTION' ? 'CRITICAL' : selectedAction === 'ISOLATE_SERVER' ? 'ISOLATED' : 'HEALTHY'
      }
    },
    'node-db': {
      id: 'node-db',
      name: 'Primary Database',
      ip: '10.0.3.200',
      zone: 4,
      zoneName: 'Zone 4: Data Tier',
      x: 750,
      y: 200,
      role: 'Backend relational datastore',
      metrics: { latencyMs: selectedAction === 'NO_ACTION' ? 340 : 4.2, status: selectedAction === 'NO_ACTION' ? 'DEGRADED' : 'HEALTHY' }
    },
    'node-redis': {
      id: 'node-redis',
      name: 'Redis Cache Cluster',
      ip: '10.0.3.50',
      zone: 4,
      zoneName: 'Zone 4: Data Tier',
      x: 750,
      y: 350,
      role: 'In-memory state cache',
      metrics: { latencyMs: 0.8, status: 'HEALTHY' }
    }
  };

  const [nodes, setNodes] = useState<Record<string, TopologyNode>>(initialNodes);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Update CPU & node metrics dynamically when selectedAction changes
  useEffect(() => {
    setNodes((prev) => ({
      ...prev,
      'node-app-server': {
        ...prev['node-app-server'],
        metrics: {
          ...prev['node-app-server'].metrics,
          cpu: selectedAction === 'NO_ACTION' ? 98 : selectedAction === 'BLOCK_SOURCES' ? 39 : 18,
          status: selectedAction === 'NO_ACTION' ? 'CRITICAL' : selectedAction === 'ISOLATE_SERVER' ? 'ISOLATED' : 'HEALTHY'
        }
      },
      'node-firewall': {
        ...prev['node-firewall'],
        metrics: {
          ...prev['node-firewall'].metrics,
          dropRate: selectedAction === 'BLOCK_SOURCES' ? 94.2 : 4.1,
          status: selectedAction === 'BLOCK_SOURCES' ? 'HEALTHY' : selectedAction === 'NO_ACTION' ? 'CRITICAL' : 'DEGRADED'
        }
      },
      'node-sinkhole': {
        ...prev['node-sinkhole'],
        metrics: {
          ...prev['node-sinkhole'].metrics,
          bandwidth: selectedAction === 'ISOLATE_SERVER' ? '4.5 Gbps' : '0 Mbps'
        }
      }
    }));
  }, [selectedAction]);

  // SVG Mouse Interaction Handlers for Node Dragging
  const getSVGCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 860 / rect.width;
    const scaleY = 460 / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const handleMouseDownNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggingNode(nodeId);
    setSelectedNodeId(nodeId);
    const node = nodes[nodeId];
    if (onSelectNode) onSelectNode(node);

    if (svgRef.current) {
      const coords = getSVGCoords(e);
      dragOffset.current = {
        x: coords.x - node.x,
        y: coords.y - node.y
      };
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | MouseEvent) => {
      if (!draggingNode) return;
      const coords = getSVGCoords(e);
      const newX = Math.max(40, Math.min(820, coords.x - dragOffset.current.x));
      const newY = Math.max(40, Math.min(420, coords.y - dragOffset.current.y));

      setNodes((prev) => ({
        ...prev,
        [draggingNode]: {
          ...prev[draggingNode],
          x: newX,
          y: newY
        }
      }));
    },
    [draggingNode, getSVGCoords]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  useEffect(() => {
    if (draggingNode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingNode, handleMouseMove, handleMouseUp]);

  // Dynamic status badges
  const targetCpu = nodes['node-app-server'].metrics.cpu || 98;
  const isCriticalNoAction = selectedAction === 'NO_ACTION';
  const isBlocked = selectedAction === 'BLOCK_SOURCES';
  const isIsolated = selectedAction === 'ISOLATE_SERVER';

  return (
    <div className="relative w-full rounded-2xl bg-[#0B0D13] border border-neutral-800 text-white shadow-2xl overflow-hidden flex flex-col font-sans transition-all">
      {/* Topology Header & Control Bar */}
      <div className="px-4 py-3 border-b border-neutral-800/80 bg-[#12151E]/90 flex flex-wrap items-center justify-between gap-3 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                Network Topology & Counterfactual Canvas
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                Live Interactive Telemetry
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              4-Zone Infrastructure Map • Real-time Module 1–3 Vector Stream
            </p>
          </div>
        </div>

        {/* Tactical Status Pill */}
        <div className="flex items-center gap-2">
          {isCriticalNoAction && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-600/60 text-rose-300 text-xs font-bold font-mono animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>CRITICAL / DDoS ATTACK IN PROGRESS</span>
            </div>
          )}
          {isBlocked && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 text-xs font-bold font-mono">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>INGRESS FILTERING ACTIVE (BLOCK_SOURCES)</span>
            </div>
          )}
          {isIsolated && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>PROTECTED / ISOLATED SERVER (SINKHOLED)</span>
            </div>
          )}
        </div>
      </div>

      {/* Layer Visibility & Vector Selector Toolbar */}
      {!compact && (
        <div className="px-4 py-2 bg-[#0E1119] border-b border-neutral-800/60 flex flex-wrap items-center justify-between gap-3 text-xs z-10 font-mono">
          {/* Attack Vector Toggle Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-400 mr-1 font-sans">Vector Mode:</span>
            <button
              onClick={() => setCurrentVector('DDOS')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentVector === 'DDOS'
                  ? 'bg-rose-600 text-white font-bold shadow-sm'
                  : 'bg-neutral-800/60 text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              ⚡ DDoS SYN Flood
            </button>
            <button
              onClick={() => setCurrentVector('RECON')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentVector === 'RECON'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'bg-neutral-800/60 text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              🔍 Recon Port Scan
            </button>
            <button
              onClick={() => setCurrentVector('EXFILTRATION')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentVector === 'EXFILTRATION'
                  ? 'bg-violet-600 text-white font-bold shadow-sm'
                  : 'bg-neutral-800/60 text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              📤 Data Exfiltration
            </button>
          </div>

          {/* Canvas Layers Checkboxes */}
          <div className="flex items-center gap-3 text-neutral-300">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showTraffic}
                onChange={(e) => setShowTraffic(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-indigo-500 focus:ring-0"
              />
              <span>Traffic Streams</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showZones}
                onChange={(e) => setShowZones(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-indigo-500 focus:ring-0"
              />
              <span>Security Zones</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-indigo-500 focus:ring-0"
              />
              <span>Threat Heatmap</span>
            </label>
          </div>
        </div>
      )}

      {/* Main Interactive SVG Topology Viewport */}
      <div className={`relative w-full ${height} bg-[#0A0C11] overflow-hidden select-none`}>
        <svg
          ref={svgRef}
          viewBox="0 0 860 460"
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <defs>
            {/* Zone Gradients */}
            <linearGradient id="zone1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E101C" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#120A13" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="zone2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E1A10" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#13100B" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="zone3Grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0A0E1A" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="zone4Grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06201B" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#041210" stopOpacity="0.4" />
            </linearGradient>

            {/* Glowing Aura Radial Gradients */}
            <radialGradient id="criticalGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#DC2626" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#991B1B" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="isolatedGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#10B981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </radialGradient>

            {/* Animated SVG Dash Filters */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* SECTION 1: 4 SECURITY ZONES BACKGROUND */}
          {showZones && (
            <g id="security-zones">
              {/* Zone 1: External */}
              <rect x="15" y="15" width="190" height="430" rx="12" fill="url(#zone1Grad)" stroke="#E11D48" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
              <text x="25" y="35" fill="#FDA4AF" fontSize="10" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.05em">
                ZONE 1: EXTERNAL / UNTRUSTED
              </text>

              {/* Zone 2: DMZ */}
              <rect x="220" y="15" width="190" height="430" rx="12" fill="url(#zone2Grad)" stroke="#F59E0B" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
              <text x="230" y="35" fill="#FDE68A" fontSize="10" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.05em">
                ZONE 2: DMZ / INGRESS
              </text>

              {/* Zone 3: App Tier */}
              <rect x="425" y="15" width="200" height="430" rx="12" fill="url(#zone3Grad)" stroke="#3B82F6" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
              <text x="435" y="35" fill="#93C5FD" fontSize="10" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.05em">
                ZONE 3: APP TIER
              </text>

              {/* Zone 4: Data Tier */}
              <rect x="640" y="15" width="205" height="430" rx="12" fill="url(#zone4Grad)" stroke="#10B981" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
              <text x="650" y="35" fill="#6EE7B7" fontSize="10" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.05em">
                ZONE 4: DATA TIER
              </text>
            </g>
          )}

          {/* SECTION 2: THREAT HEATMAP LAYER */}
          {showHeatmap && (
            <g id="heatmap-overlay">
              {/* Critical halo around Botnet */}
              <circle cx={nodes['node-botnet'].x} cy={nodes['node-botnet'].y} r="75" fill="url(#criticalGlow)" opacity="0.6" />

              {/* Heatmap around App Server if under attack */}
              {isCriticalNoAction && (
                <circle cx={nodes['node-app-server'].x} cy={nodes['node-app-server'].y} r="90" fill="url(#criticalGlow)" opacity="0.8">
                  <animate attributeName="r" values="70;95;70" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Isolated Forcefield Glow if ISOLATE_SERVER active */}
              {isIsolated && (
                <circle cx={nodes['node-app-server'].x} cy={nodes['node-app-server'].y} r="85" fill="url(#isolatedGlow)" opacity="0.8">
                  <animate attributeName="r" values="80;90;80" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          )}

          {/* SECTION 3: TOPOLOGY EDGE CONNECTORS & SVG PACKET ANIMATIONS */}
          <g id="topology-edges">
            {/* 1. Legitimate Stream: Clients -> Firewall -> Gateway -> App Server -> DB */}
            <path
              d={`M ${nodes['node-clients'].x} ${nodes['node-clients'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y}`}
              stroke="#38BDF8"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeOpacity="0.6"
            />
            <path
              d={`M ${nodes['node-gateway'].x} ${nodes['node-gateway'].y} L ${nodes['node-app-server'].x} ${nodes['node-app-server'].y}`}
              stroke="#38BDF8"
              strokeWidth="2"
              strokeOpacity="0.5"
            />
            <path
              d={`M ${nodes['node-app-server'].x} ${nodes['node-app-server'].y} L ${nodes['node-db'].x} ${nodes['node-db'].y}`}
              stroke="#34D399"
              strokeWidth="2"
              strokeOpacity="0.5"
            />

            {/* 2. Attack Vector Stream: Botnet -> Firewall -> Gateway / Sinkhole */}
            {/* Botnet to Firewall edge */}
            <path
              d={`M ${nodes['node-botnet'].x} ${nodes['node-botnet'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y}`}
              stroke={isBlocked ? '#F59E0B' : '#EF4444'}
              strokeWidth={isBlocked ? '3' : '4'}
              strokeDasharray={isBlocked ? '6 6' : 'none'}
              filter="url(#glow)"
            />

            {/* Firewall to Gateway OR Firewall to Sinkhole depending on mitigation */}
            {isIsolated ? (
              // Rerouted path to BGP Sinkhole
              <path
                d={`M ${nodes['node-firewall'].x} ${nodes['node-firewall'].y} Q 380 320 ${nodes['node-sinkhole'].x} ${nodes['node-sinkhole'].y}`}
                stroke="#06B6D4"
                strokeWidth="4"
                strokeDasharray="8 4"
                filter="url(#glow)"
              />
            ) : (
              // Firewall to Gateway normal path
              <path
                d={`M ${nodes['node-firewall'].x} ${nodes['node-firewall'].y} L ${nodes['node-gateway'].x} ${nodes['node-gateway'].y}`}
                stroke={isBlocked ? '#64748B' : '#EF4444'}
                strokeWidth={isBlocked ? '1.5' : '4'}
                strokeOpacity={isBlocked ? 0.4 : 1}
                filter={isBlocked ? undefined : 'url(#glow)'}
              />
            )}

            {/* ANIMATED PACKET STREAM DOTS */}
            {showTraffic && (
              <g id="animated-packets">
                {/* Legitimate Traffic Packets (Cyan) */}
                <circle r="4" fill="#38BDF8">
                  <animateMotion
                    path={`M ${nodes['node-clients'].x} ${nodes['node-clients'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y} L ${nodes['node-gateway'].x} ${nodes['node-gateway'].y} L ${nodes['node-app-server'].x} ${nodes['node-app-server'].y}`}
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Malicious Attack Vector Streams */}
                {currentVector === 'DDOS' && (
                  <>
                    {/* NO_ACTION mode: Aggressive pulsing red dots reach Target App Server */}
                    {isCriticalNoAction && (
                      <>
                        <circle r="6" fill="#F43F5E">
                          <animateMotion
                            path={`M ${nodes['node-botnet'].x} ${nodes['node-botnet'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y} L ${nodes['node-gateway'].x} ${nodes['node-gateway'].y} L ${nodes['node-app-server'].x} ${nodes['node-app-server'].y}`}
                            dur="0.8s"
                            repeatCount="indefinite"
                          />
                        </circle>
                        <circle r="5" fill="#FB7185">
                          <animateMotion
                            path={`M ${nodes['node-botnet'].x} ${nodes['node-botnet'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y} L ${nodes['node-gateway'].x} ${nodes['node-gateway'].y} L ${nodes['node-app-server'].x} ${nodes['node-app-server'].y}`}
                            dur="1.2s"
                            begin="0.3s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      </>
                    )}

                    {/* BLOCK_SOURCES mode: Packets dissolve at Firewall */}
                    {isBlocked && (
                      <circle r="5" fill="#F59E0B">
                        <animateMotion
                          path={`M ${nodes['node-botnet'].x} ${nodes['node-botnet'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y}`}
                          dur="1s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* ISOLATE_SERVER mode: Attack packets rerouted to BGP Sinkhole */}
                    {isIsolated && (
                      <circle r="6" fill="#06B6D4">
                        <animateMotion
                          path={`M ${nodes['node-botnet'].x} ${nodes['node-botnet'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y} Q 380 320 ${nodes['node-sinkhole'].x} ${nodes['node-sinkhole'].y}`}
                          dur="1s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </>
                )}

                {/* Recon Vector: Sonar Arcs */}
                {currentVector === 'RECON' && (
                  <circle r="5" fill="#FBBF24">
                    <animateMotion
                      path={`M ${nodes['node-botnet'].x} ${nodes['node-botnet'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y} L ${nodes['node-gateway'].x} ${nodes['node-gateway'].y}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Data Exfiltration Vector: Reverse Red Packets DB -> C2 */}
                {currentVector === 'EXFILTRATION' && (
                  <circle r="6" fill="#A855F7">
                    <animateMotion
                      path={`M ${nodes['node-db'].x} ${nodes['node-db'].y} L ${nodes['node-app-server'].x} ${nodes['node-app-server'].y} L ${nodes['node-gateway'].x} ${nodes['node-gateway'].y} L ${nodes['node-firewall'].x} ${nodes['node-firewall'].y} L ${nodes['node-botnet'].x} ${nodes['node-botnet'].y}`}
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            )}
          </g>

          {/* SECTION 4: SPECIAL VISUAL EFFECT OVERLAYS (Shields, Barriers, Dissolve Badges) */}
          <g id="tactical-overlays">
            {/* Blocked Source Firewall Shield Icon with Red X */}
            {isBlocked && (
              <g transform={`translate(${nodes['node-firewall'].x - 14}, ${nodes['node-firewall'].y - 45})`}>
                <rect width="28" height="28" rx="6" fill="#78350F" stroke="#F59E0B" strokeWidth="1.5" />
                <text x="7" y="19" fill="#FDE68A" fontSize="16" fontWeight="bold">
                  ✕
                </text>
              </g>
            )}

            {/* Target Server Cyan/Emerald Forcefield Shield Ring */}
            {isIsolated && (
              <g transform={`translate(${nodes['node-app-server'].x}, ${nodes['node-app-server'].y})`}>
                <circle r="44" fill="none" stroke="#10B981" strokeWidth="2.5" strokeDasharray="6 4" filter="url(#glow)">
                  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite" />
                </circle>
                <circle r="52" fill="none" stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="12 6" strokeOpacity="0.7">
                  <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="15s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </g>

          {/* SECTION 5: INTERACTIVE TOPOLOGY NODES RENDERER */}
          <g id="topology-nodes">
            {Object.values(nodes).map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isTargetApp = node.id === 'node-app-server';
              const isFirewall = node.id === 'node-firewall';
              const isSinkhole = node.id === 'node-sinkhole';

              // Dynamic node status border colors
              let strokeColor = '#3B82F6';
              let nodeBg = '#1E293B';

              if (node.metrics.status === 'CRITICAL') {
                strokeColor = '#EF4444';
                nodeBg = '#451A22';
              } else if (node.metrics.status === 'DEGRADED') {
                strokeColor = '#F59E0B';
                nodeBg = '#382813';
              } else if (node.metrics.status === 'ISOLATED' || node.metrics.status === 'SINKHOLED') {
                strokeColor = '#10B981';
                nodeBg = '#062E26';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                  className="cursor-grab active:cursor-grabbing transition-transform hover:scale-105"
                >
                  {/* Node Outer Selection Ring */}
                  {isSelected && (
                    <circle r="36" fill="none" stroke="#6366F1" strokeWidth="2" strokeDasharray="4 4">
                      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Base Circle Container */}
                  <circle
                    r="28"
                    fill={nodeBg}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? '3' : '2'}
                    filter="url(#glow)"
                  />

                  {/* Node Icon Graphics */}
                  {node.id === 'node-botnet' && (
                    <g transform="translate(-10, -10)">
                      <Globe className="w-5 h-5 text-rose-400" />
                    </g>
                  )}
                  {node.id === 'node-clients' && (
                    <g transform="translate(-10, -10)">
                      <Radio className="w-5 h-5 text-sky-400" />
                    </g>
                  )}
                  {isFirewall && (
                    <g transform="translate(-10, -10)">
                      <Shield className="w-5 h-5 text-amber-400" />
                    </g>
                  )}
                  {node.id === 'node-gateway' && (
                    <g transform="translate(-10, -10)">
                      <Zap className="w-5 h-5 text-indigo-400" />
                    </g>
                  )}
                  {isTargetApp && (
                    <g transform="translate(-10, -10)">
                      <Server className={`w-5 h-5 ${isIsolated ? 'text-emerald-400' : isCriticalNoAction ? 'text-rose-400 animate-bounce' : 'text-sky-400'}`} />
                    </g>
                  )}
                  {node.id === 'node-db' && (
                    <g transform="translate(-10, -10)">
                      <Database className="w-5 h-5 text-emerald-400" />
                    </g>
                  )}
                  {node.id === 'node-redis' && (
                    <g transform="translate(-10, -10)">
                      <Activity className="w-5 h-5 text-emerald-300" />
                    </g>
                  )}
                  {isSinkhole && (
                    <g transform="translate(-10, -10)">
                      <Lock className="w-5 h-5 text-cyan-400" />
                    </g>
                  )}

                  {/* Node Name Label */}
                  <text
                    y="42"
                    textAnchor="middle"
                    fill="#F1F5F9"
                    fontSize="11"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {node.name}
                  </text>

                  {/* IP Subnet Tag */}
                  <text
                    y="55"
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {node.ip}
                  </text>

                  {/* Target Host Live CPU Saturation Meter (Requirement #3) */}
                  {isTargetApp && (
                    <g transform="translate(-30, -48)">
                      <rect width="60" height="14" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="1" />
                      <rect
                        width={Math.max(4, (targetCpu / 100) * 58)}
                        height="12"
                        x="1"
                        y="1"
                        rx="3"
                        fill={targetCpu > 80 ? '#EF4444' : targetCpu > 30 ? '#F59E0B' : '#10B981'}
                      />
                      <text x="30" y="10" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontFamily="monospace" fontWeight="bold">
                        CPU {targetCpu}%
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Instruction Banner */}
        <div className="absolute bottom-3 left-3 bg-[#121622]/90 border border-neutral-800 rounded-lg px-3 py-1.5 text-[11px] text-neutral-400 flex items-center gap-2 pointer-events-none font-mono">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          <span>Interactive Canvas • Drag nodes to reposition • Click to inspect telemetry</span>
        </div>
      </div>
    </div>
  );
};
