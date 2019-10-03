#!/usr/bin/env bash

echo Starting ssh test
echo Press Ctrl-C to exit

source ./integration/ssh/env-vars.sh

export N=1
for i in {1..16}
do 
	echo Test with $N lines
	mkdir -p ./logs/ssh/$N

	echo Killing nodes and skyssh-cli
	echo Killing $(ps aux |grep "[N]odeA\|[N]odeB\|[N]odeC\|[s]kywire/skyssh-cli" |awk '{print $2}')
	kill $(ps aux |grep "[N]odeA\|[N]odeB\|[N]odeC\|[s]kywire/skyssh-cli" |awk '{print $2}')

	echo Restarting nodes
	./bin/skywire-visor ./integration/ssh/nodeA.json --tag NodeA &> ./logs/ssh/$N/nodeA.log &
	./bin/skywire-visor ./integration/intermediary-nodeB.json --tag NodeB  &> ./logs/ssh/$N/nodeB.log &
	./bin/skywire-visor ./integration/ssh/nodeC.json --tag NodeC &> ./logs/ssh/$N/nodeC.log &

	sleep 20
	echo Trying skyssh-cli
	export CMD=$(echo ./bin/skyssh-cli $PK_A \"loop -n $N echo A\")
	echo $CMD 
	eval $CMD &>./logs/ssh/$N/skyssh-cli.out


	export N=$(($N*2))
done
