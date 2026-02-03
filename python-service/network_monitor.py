"""
Network Monitoring Module for IAIS
Monitors network traffic during interview to detect suspicious activity.

Uses Scapy for packet capture and analysis.
"""

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime
import threading


@dataclass
class NetworkEvent:
    """Represents a network event"""
    timestamp: datetime
    protocol: str
    source_ip: str
    dest_ip: str
    port: int
    packet_size: int
    is_suspicious: bool


class NetworkMonitor:
    """
    Network Traffic Monitor for Interview Proctoring
    
    Detects suspicious network activity such as:
    - Unusual outbound connections
    - High data transfer during questions
    - Connections to suspicious domains
    """
    
    def __init__(
        self,
        suspicious_ports: Optional[List[int]] = None,
        max_packets_per_minute: int = 100,
        monitoring_enabled: bool = False  # Disabled by default (requires admin)
    ):
        """
        Initialize Network Monitor
        
        Args:
            suspicious_ports: List of ports to flag (e.g., SSH, VNC)
            max_packets_per_minute: Threshold for high traffic
            monitoring_enabled: Enable actual packet capture (requires admin)
        """
        self.suspicious_ports = suspicious_ports or [22, 5900, 3389, 5800]
        self.max_packets_per_minute = max_packets_per_minute
        self.monitoring_enabled = monitoring_enabled
        
        # Traffic tracking
        self.network_events: List[NetworkEvent] = []
        self.packet_count: deque = deque(maxlen=1000)
        self.suspicious_connections: List[NetworkEvent] = []
        
        # Monitoring state
        self.is_monitoring = False
        self.monitor_thread: Optional[threading.Thread] = None
        
        # Statistics
        self.total_packets = 0
        self.total_suspicious = 0
        
    def start_monitoring(self):
        """Start network monitoring in background thread"""
        if not self.monitoring_enabled:
            print("[Network] Monitoring disabled (requires admin privileges)")
            return
        
        if self.is_monitoring:
            print("[Network] Already monitoring")
            return
        
        self.is_monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        print("[Network] Monitoring started")
    
    def stop_monitoring(self):
        """Stop network monitoring"""
        self.is_monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=2)
        print("[Network] Monitoring stopped")
    
    def _monitor_loop(self):
        """
        Main monitoring loop (runs in background thread)
        
        Note: Actual packet capture requires Scapy and admin privileges.
        This is a simplified simulation for demo purposes.
        """
        try:
            # In production, use Scapy:
            # from scapy.all import sniff
            # sniff(prn=self._process_packet, store=False)
            
            # Simulation mode
            print("[Network] Running in simulation mode")
            while self.is_monitoring:
                time.sleep(1)
                # Simulate random network activity
                self._simulate_network_activity()
                
        except Exception as e:
            print(f"[Network] Monitoring error: {e}")
            self.is_monitoring = False
    
    def _simulate_network_activity(self):
        """Simulate network activity for demo"""
        import random
        
        # Simulate 5-15 packets per second
        num_packets = random.randint(5, 15)
        
        for _ in range(num_packets):
            event = NetworkEvent(
                timestamp=datetime.now(),
                protocol=random.choice(['TCP', 'UDP', 'HTTP', 'HTTPS']),
                source_ip='192.168.1.100',
                dest_ip=f'192.168.1.{random.randint(1, 255)}',
                port=random.choice([80, 443, 22, 3389, 5900, 8080]),
                packet_size=random.randint(64, 1500),
                is_suspicious=False
            )
            
            # Check if suspicious
            if event.port in self.suspicious_ports:
                event.is_suspicious = True
                self.suspicious_connections.append(event)
                self.total_suspicious += 1
            
            self.network_events.append(event)
            self.packet_count.append(time.time())
            self.total_packets += 1
    
    def _process_packet(self, packet):
        """
        Process captured network packet (for real Scapy integration)
        
        Args:
            packet: Scapy packet object
        """
        # Example Scapy packet processing:
        # if packet.haslayer('IP'):
        #     ip_layer = packet['IP']
        #     event = NetworkEvent(...)
        #     self.network_events.append(event)
        pass
    
    def get_network_score(self) -> float:
        """
        Calculate network anomaly score (0-1)
        
        Returns:
            Network anomaly score
        """
        if not self.network_events:
            return 0.0
        
        # Calculate packets per minute
        current_time = time.time()
        recent_packets = [t for t in self.packet_count if current_time - t <= 60]
        packets_per_minute = len(recent_packets)
        
        # Score based on suspicious connections and high traffic
        suspicious_ratio = self.total_suspicious / max(1, self.total_packets)
        traffic_score = min(1.0, packets_per_minute / self.max_packets_per_minute)
        
        # Weighted combination
        network_score = (0.7 * suspicious_ratio) + (0.3 * traffic_score)
        
        return min(1.0, network_score)
    
    def get_statistics(self) -> Dict[str, any]:
        """Get network monitoring statistics"""
        current_time = time.time()
        recent_packets = [t for t in self.packet_count if current_time - t <= 60]
        
        return {
            'total_packets': self.total_packets,
            'total_suspicious': self.total_suspicious,
            'packets_per_minute': len(recent_packets),
            'network_score': self.get_network_score(),
            'suspicious_ports_detected': list(set(
                e.port for e in self.suspicious_connections
            )),
            'monitoring_enabled': self.monitoring_enabled,
            'is_monitoring': self.is_monitoring
        }
    
    def reset(self):
        """Reset monitor state"""
        self.network_events.clear()
        self.packet_count.clear()
        self.suspicious_connections.clear()
        self.total_packets = 0
        self.total_suspicious = 0
        print("[Network] Monitor reset")


# Demo function
def demo_network_monitor():
    """Demo network monitoring"""
    print("=" * 60)
    print("Network Monitor Demo")
    print("=" * 60)
    
    monitor = NetworkMonitor(monitoring_enabled=True)
    monitor.start_monitoring()
    
    print("\nMonitoring network for 10 seconds...")
    time.sleep(10)
    
    stats = monitor.get_statistics()
    print("\n" + "=" * 60)
    print("NETWORK STATISTICS")
    print("=" * 60)
    for key, value in stats.items():
        print(f"{key}: {value}")
    
    monitor.stop_monitoring()


if __name__ == "__main__":
    demo_network_monitor()
