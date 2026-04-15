import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Activity, 
  Play, 
  Square, 
  Settings2, 
  History, 
  AlertCircle, 
  Wifi, 
  WifiOff,
  ChevronRight,
  Trash2,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { flattenObject, getDiff } from '@/lib/telemetry';
import { cn } from '@/lib/utils';

interface LogEntry {
  timestamp: string;
  key: string;
  oldValue: any;
  newValue: any;
}

export default function App() {
  const [url, setUrl] = useState('wss://echo.websocket.org');
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const [currentData, setCurrentData] = useState<any>(null);
  const [previousData, setPreviousData] = useState<any>(null);
  const [diffs, setDiffs] = useState<Set<string>>(new Set());
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [observedFields, setObservedFields] = useState<Set<string>>(new Set());
  const [fieldFilter, setFieldFilter] = useState('');
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [sessionTime, setSessionTime] = useState(0);
  
  const socketRef = useRef<WebSocket | null>(null);
  const lastDataRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const observedFieldsRef = useRef(observedFields);

  useEffect(() => {
    observedFieldsRef.current = observedFields;
  }, [observedFields]);

  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setSessionTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  const connect = useCallback(() => {
    if (!url) return;
    
    setStatus('connecting');
    setError(null);
    
    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setStatus('connected');
      };

      socket.onmessage = (event) => {
        try {
          const rawData = JSON.parse(event.data);
          const flatData = flattenObject(rawData);
          
          const newKeys = Object.keys(flatData);
          setAvailableFields(prev => {
            const combined = Array.from(new Set([...prev, ...newKeys]));
            return combined.sort();
          });

          if (lastDataRef.current) {
            const currentDiffs = getDiff(lastDataRef.current, flatData);
            setDiffs(currentDiffs);
            
            const newLogs: LogEntry[] = [];
            currentDiffs.forEach(key => {
              if (observedFieldsRef.current.size === 0 || observedFieldsRef.current.has(key)) {
                newLogs.push({
                  timestamp: new Date().toLocaleTimeString(),
                  key,
                  oldValue: lastDataRef.current[key],
                  newValue: flatData[key]
                });
              }
            });
            
            if (newLogs.length > 0) {
              setHistory(prev => [ ...newLogs, ...prev].slice(0, 50));
            }
            
            setPreviousData(lastDataRef.current);
          }

          setCurrentData(flatData);
          lastDataRef.current = flatData;
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        setStatus('idle');
        socketRef.current = null;
      };

      socket.onerror = () => {
        setError('Connection error occurred');
        setStatus('error');
        setIsConnected(false);
      };
    } catch (e) {
      setError('Invalid WebSocket URL');
      setStatus('error');
    }
  }, [url, observedFields]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setStatus('idle');
  }, []);

  const toggleFieldObservation = (field: string) => {
    setObservedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const selectAllFields = () => {
    setObservedFields(new Set(availableFields));
  };

  const clearHistory = () => setHistory([]);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  return (
    <div className="h-screen bg-background text-foreground font-sans selection:bg-accent/30 flex flex-col overflow-hidden">
      <header className="border-b-2 border-border p-4 flex gap-4 items-center bg-background shrink-0">
        <div className="branding shrink-0">WS Telemetry Data Observer</div>
        <div className="flex-1 flex border border-border bg-white overflow-hidden max-w-3xl">
          <Input 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter WebSocket URL..."
            className="border-none rounded-none h-9 font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isConnected}
          />
          <Button 
            onClick={isConnected ? disconnect : connect}
            className={cn(
              "rounded-none h-9 px-5 font-bold uppercase text-[11px] tracking-wider transition-all border-l border-border",
              isConnected ? "bg-accent text-white hover:bg-accent/90" : "bg-foreground text-background hover:bg-foreground/90"
            )}
            disabled={status === 'connecting'}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
        {error && (
          <div className="text-accent text-[10px] font-bold flex items-center gap-1 uppercase">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase opacity-60">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-zinc-300")} />
            {status}
          </div>
          <div className="h-4 w-px bg-border" />
          <div>{formatTime(sessionTime)}</div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Field Observer Settings */}
          <ResizablePanel defaultSize={20} minSize={15} className="flex flex-col min-h-0">
            <div className="panel-header shrink-0">
              <span>Schema Fields</span>
              <span className="opacity-50">({availableFields.length})</span>
            </div>
            <div className="p-2 border-b border-border bg-white shrink-0">
              <Input 
                placeholder="Filter fields..."
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.target.value)}
                className="h-7 text-[10px] font-mono rounded-none border-border"
              />
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-6 text-[9px] uppercase font-bold rounded-none"
                  onClick={() => setObservedFields(new Set())}
                >
                  Select None
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 h-6 text-[9px] uppercase font-bold rounded-none"
                  onClick={selectAllFields}
                >
                  Select All
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="divide-y divide-border">
                {availableFields.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-8 italic">No fields detected</p>
                ) : (
                  availableFields
                    .filter(f => f.toLowerCase().includes(fieldFilter.toLowerCase()))
                    .map(field => (
                    <div 
                      key={field} 
                      className="flex items-center gap-3 px-3 py-2 hover:bg-black/5 cursor-pointer group"
                      onClick={() => toggleFieldObservation(field)}
                    >
                      <Switch 
                        checked={observedFields.has(field)}
                        onCheckedChange={() => toggleFieldObservation(field)}
                        className="scale-75 data-[state=checked]:bg-foreground"
                      />
                      <span className="text-xs truncate flex-1" title={field}>{field}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle />

          {/* Real-time Feed */}
          <ResizablePanel defaultSize={50} minSize={30} className="flex flex-col min-h-0 bg-white">
            <div className="panel-header shrink-0">
              <span>Live Stream</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] border-border/20 text-muted-foreground font-mono">
                  {Object.keys(currentData || {}).length} KEYS
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 font-mono text-[12px] leading-relaxed">
                {!currentData ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-20">
                    <Activity className="w-8 h-8 opacity-20" />
                    <p className="text-[10px] uppercase tracking-widest font-bold">Waiting for data...</p>
                  </div>
                ) : observedFields.size === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-20">
                    <Settings2 className="w-8 h-8 opacity-20" />
                    <p className="text-[10px] uppercase tracking-widest font-bold">Select fields to observe</p>
                  </div>
                ) : (
                  <div className="json-block current">
                    <div className="text-zinc-400">{"{"}</div>
                    {Object.entries(currentData).map(([key, value], idx, arr) => {
                      const isChanged = diffs.has(key);
                      const isObserved = observedFields.has(key);
                      if (!isObserved) return null;

                      return (
                        <div key={key} className="pl-4 flex gap-2 items-start py-0.5">
                          <span className="text-[#881391] shrink-0">"{key}"</span>: 
                          <div className="flex-1 relative">
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={`${key}-${JSON.stringify(value)}`}
                                initial={isChanged ? { backgroundColor: 'rgba(232, 74, 39, 0.2)', fontWeight: 'bold' } : false}
                                animate={{ backgroundColor: 'transparent', fontWeight: 'normal' }}
                                transition={{ duration: 1.5 }}
                                className={cn(
                                  "px-1 rounded-sm",
                                  typeof value === 'string' ? "text-[#1a1aa6]" : "text-[#1c00cf]"
                                )}
                              >
                                {JSON.stringify(value)}
                              </motion.span>
                            </AnimatePresence>
                            {idx < arr.length - 1 ? ',' : ''}
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-zinc-400">{"}"}</div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle />

          {/* Observer / Change Tracker */}
          <ResizablePanel defaultSize={30} minSize={20} className="flex flex-col min-h-0 bg-surface">
            <div className="panel-header shrink-0">
              <span>Observation Log</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 text-muted-foreground hover:text-accent"
                onClick={clearHistory}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {history.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-8 italic">No changes recorded</p>
                  ) : (
                    history.map((entry, i) => (
                      <motion.div 
                        key={`${entry.timestamp}-${entry.key}-${i}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "change-card",
                          i === 0 && "flash"
                        )}
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-2">
                          <span className="text-accent font-mono truncate mr-2">{entry.key}</span>
                          <span className="opacity-40 shrink-0">{entry.timestamp}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                          <div className="bg-black/5 p-1 rounded-sm text-muted-foreground line-through truncate">
                            {JSON.stringify(entry.oldValue)}
                          </div>
                          <div className="bg-emerald-50 p-1 rounded-sm text-emerald-700 font-bold truncate">
                            {JSON.stringify(entry.newValue)}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
            <div className="meta-info shrink-0 border-t border-border">
              LOGS: {history.length} | OBSERVED: {observedFields.size}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
