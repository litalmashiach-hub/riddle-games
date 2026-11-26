"""TEST ONLY. Sums up what pf logged during the cut (net/pflog.txt) and which process held each address (net/sockets.txt).
   python3 summary.py <out dir>"""
import gzip, os, re, sys
from collections import Counter, defaultdict

out = sys.argv[1]
n = os.path.join(out, 'net')
def text(name):
    p = os.path.join(n, name)
    if os.path.exists(p): return open(p, errors='replace').read()
    if os.path.exists(p + '.gz'): return gzip.open(p + '.gz', 'rt', errors='replace').read()
    return ''

keep = set(l.split()[0] for l in text('keep.txt').splitlines() if l.strip())
owners = defaultdict(set)
for line in text('sockets.txt').splitlines():
    if line.startswith('==') or line.startswith('COMMAND'): continue
    parts = line.split()
    if len(parts) < 9: continue
    m = re.search(r'->\[?([0-9a-fA-F:.]+?)\]?:(\d+|\*)', line)
    if m: owners[m.group(1)].add(parts[0])

blocked, passed, dns = Counter(), Counter(), Counter()
addr = r'([0-9a-fA-F:.]+)\.(\d+)'
for line in text('pflog.txt').splitlines():
    m = re.search(r'\b(block|pass) (in|out) on (\S+): ', line)
    if m:
        rest = line[m.end():]
        mm = re.match(addr + r' > ' + addr, rest)
        if mm:
            key = (m.group(2), mm.group(3), mm.group(4))
            (blocked if m.group(1) == 'block' else passed)[key] += 1
    for q in re.findall(r'\b(?:A|AAAA|HTTPS|SVCB|PTR|CNAME|TXT|SRV)\? ([^ ]+?)\.? ', line):
        dns[q] += 1

print('Connections pf refused while the network was cut (direction, address, port: packets; processes seen with that address):')
for (d, ip, port), c in sorted(blocked.items(), key=lambda x: -x[1]):
    if d == 'out' or True:
        print(f'  {d} {ip} port {port}: {c}; {", ".join(sorted(owners.get(ip, []))) or "no process seen holding it"}')
if not blocked: print('  none')
print('\nNames looked up while the network was cut (lookups are let through so the runner can find its hosts):')
for q, c in sorted(dns.items(), key=lambda x: -x[1]): print(f'  {q}: {c}')
if not dns: print('  none')
print('\nAddresses pf let through that are not loopback, lookups or the runner\'s kept ones:')
odd = [(k, c) for k, c in passed.items() if k[1] not in keep and k[2] != '53' and not (k[0] == 'in')]
for (d, ip, port), c in odd: print(f'  {d} {ip} port {port}: {c}; {", ".join(sorted(owners.get(ip, [])))}')
if not odd: print('  none')
print('\nThe runner\'s kept addresses that were used (outward): ' + str(len({k[1] for k in passed if k[1] in keep})))
print('Processes seen holding a non-loopback socket at any time during the cut:')
procs = Counter(p for s in owners.values() for p in s)
for p, c in procs.most_common(): print(f'  {p}: {c} addresses')
