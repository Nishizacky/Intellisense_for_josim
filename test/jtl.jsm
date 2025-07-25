* Example JTL Basic
B01                3   7                jmod           area=2.16
B02                6   8                jmod           area=2.16
IB01               0   1               pwl(0 0 5p 280u)
L01                4   3  2p    
L02                3   2              2.425p    
L03                2   6              2.425p    
L04                6   5              2.031p    
LP01               0   7              0.086p    
LP02               0   8              0.096p    
LPR01              2   1              0.278p    
LRB01              7   9              0.086p    
LRB02              8  10              0.086p    
RB01               9   3                5.23    
RB02              10   6                5.23    
ROUT               5   0   2
VIN                4   0               pwl(0 0 300p 0 302.5p 827.13u 305p 0 600p 0 602.5p 827.13u 605p 0)
.model jmod jj(rtype=1, vg=2.8mV, cap=0.07pF, r0=160, rN=16, icrit=0.1mA)
.tran 0.25p 1000p 0 0.25p
.print DEVV VIN
.print DEVI ROUT
.print PHASE B01
.print PHSE B02
* .file hogehoge.csv
.end