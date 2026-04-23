import * as React from 'react';

import { Badge } from '@mumak/ui/components/badge';
import { Button } from '@mumak/ui/components/button';
import { Card, CardContent } from '@mumak/ui/components/card';

export function Counter() {
  const [count, setCount] = React.useState(0);

  return (
    <Card className="w-[300px]">
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <Badge variant="secondary" className="text-2xl px-4 py-2">
            Count: {count}
          </Badge>
        </div>
        <div className="flex justify-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => setCount(count - 1)} className="h-10 w-10">
            -
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCount(count + 1)} className="h-10 w-10">
            +
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
